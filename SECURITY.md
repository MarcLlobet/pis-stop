# Seguretat de Pis Stop

Aquest document explica què protegeix Pis Stop, com ho fa i, sobretot, **què no protegeix**. Està
pensat perquè una persona escèptica pugui comprovar cada afirmació per si mateixa, sense haver de
confiar en ningú. L’especificació tècnica exacta és a [docs/PROTOCOL.md](docs/PROTOCOL.md).

> Això és una auto-avaluació, no una auditoria externa. Si trobes un forat, mira
> [Com reportar una vulnerabilitat](#com-reportar-una-vulnerabilitat).

## En 30 segons

- **Les fotos es xifren al mòbil** abans de sortir-ne. El servidor (Cloudinary) guarda blocs de
  bytes aleatoris i no té la clau.
- **La clau viatja dins del QR**, en una part de l’enllaç que el navegador no envia mai a cap
  servidor.
- **Cada foto va signada** per qui l’ha feta. Tenir la clau del grup permet veure-ho tot, però no
  fer-se passar per una altra persona.
- **Tot es verifica en carregar.** El que no està ben signat o no té el format esperat, no es
  mostra.
- **No hi ha backend propi**: no hi ha cap base de dades ni servidor nostre que es pugui atacar o
  que pugui guardar registres.
- **La ubicació en viu és opcional i es xifra igual que les fotos.** Només la veuen els qui també
  l’han activada en aquell moment; no es guarda enlloc, ni tan sols temporalment en un servidor.

## Qui pot veure què

| Qui                                       | Què pot fer                                                                                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Algú del grup (té el QR)                  | Veure totes les fotos. Penjar-ne en nom propi mentre l’event estigui obert.                                                               |
| Algú del grup que vol enganyar            | Penjar fotos com a ell mateix. **No pot** penjar-ne en nom d’un altre, ni afegir pisos, ni canviar fotos existents.                       |
| Algú amb l’enllaç de la web però sense QR | Res de l’event: ni sap on són les dades ni les pot desxifrar.                                                                             |
| Algú que llegeix tot el codi públic       | El mateix: el codi no conté cap secret.                                                                                                   |
| Cloudinary (o qui en controli el compte)  | Veure que existeixen fitxers, quan es pugen, des de quines IP i la mida aproximada. Esborrar-ne. **No pot** llegir-los ni falsificar-los. |
| Ably (si teniu ubicació en viu)           | Veure que algú s’ha connectat, quan, i amb quina freqüència envia senyals. **No pot** veure on és ningú ni fer-se passar per algú.        |
| GitHub (que serveix la web)               | Veure qui visita la web. Vegeu [El codi que executa el navegador](#4-el-codi-que-executa-el-navegador).                                   |

## Com funciona

### 1. La clau del grup

En crear l’event, l’organitzador genera al seu ordinador:

- un **secret de 256 bits** aleatori;
- una **clau de signatura d’organitzador** (ECDSA P-256).

El QR conté `…/pis-stop/#k=<secret>&o=<empremta de l’organitzador>`. Tot el que va després del `#`
és el _fragment_ d’una URL, i els navegadors **no l’envien mai** al servidor. GitHub Pages rep una
petició a `/pis-stop/` i prou.

Quan obres l’enllaç, l’app:

1. Deriva del secret, amb HKDF-SHA-256, dues coses independents: el **tag** (on són les dades) i
   una **clau AES-256** (com es xifren).
2. Guarda la clau AES a IndexedDB com a **clau no exportable**: el codi de la pàgina la pot fer
   servir, però el navegador es nega a donar-ne els bytes, ni tan sols a la mateixa pàgina.
3. Desa també la invitació (el secret i l’empremta) a IndexedDB, perquè qualsevol del grup pugui
   ensenyar el QR a algú altre des de **Convida**. A diferència de la clau AES, aquesta sí que la
   pot llegir el codi de la pàgina (vegeu el límit 12).
4. Esborra el fragment de la barra d’adreces i de l’historial (`history.replaceState`).

També es pot entrar escanejant el QR des de la mateixa app (amb el lector de QR del navegador,
`BarcodeDetector`: la imatge de la càmera no surt del mòbil) o enganxant l’enllaç. Sense invitació,
l’app no ensenya res: ni mapa, ni fotos, ni demo (la demo només apareix en un desplegament sense
compte de fotos configurat). Com que és aleatori i de 256 bits, no cal cap funció lenta
tipus PBKDF2: no hi ha contrasenya que endevinar.

### 2. El xifratge

Cada cosa que es puja (un perfil, una foto, la llista de pisos) es xifra amb **AES-256-GCM**:

- **IV aleatori de 96 bits** per a cada missatge. No es reutilitza mai.
- **Autenticació**: GCM detecta qualsevol canvi d’un sol bit. Un fitxer manipulat simplement no
  s’obre.
- **Dades associades (AAD)**: cada xifrat porta lligat el seu propòsit (`entry` o `photo/<id>`).
  Una foto no es pot fer passar per una altra foto, ni per una entrada.
- **Versió** al primer byte, per poder canviar d’algorisme en el futur sense ambigüitats.
- **Farciment Padmé**: la mida real s’arrodoneix cap amunt (com a màxim un 12%). Així la mida del
  fitxer xifrat revela molt menys sobre què conté.

### 3. Les signatures

Encriptar protegeix de la gent de fora. Les signatures protegeixen de la gent de dins.

- En fer-te el perfil, el teu mòbil genera una **clau de signatura ECDSA P-256 no exportable**.
  No surt mai del mòbil.
- El teu **identificador és l’empremta de la teva clau pública** (els primers 128 bits del
  SHA-256). Per tenir el teu identificador cal tenir la teva clau: ningú pot crear un perfil
  amb el teu id.
- Cada foto que penges va signada. En carregar, l’app comprova que la signatura correspon al
  perfil que diu ser-ne l’autor.
- L’**esdeveniment i els pisos** van signats per l’organitzador. L’app només accepta la clau
  d’organitzador que coincideix amb l’empremta del QR, no la que digui cap fitxer.
- Al costat de cada nom es mostra un **codi de seguretat** (com els de Signal) que podeu comparar
  en persona.
- Cada esdeveniment té la seva pròpia identitat: no es poden relacionar perfils de grups
  diferents.

### 4. El codi que executa el navegador

- **Content Security Policy** estricta (vegeu `vite.config.ts`): només s’executa JavaScript del
  mateix lloc, no es pot carregar res de tercers, i la web només pot parlar amb Cloudinary i,
  si teniu ubicació en viu, amb Ably.
- **Cap HTML a partir de text**: ESLint prohibeix `innerHTML`, `dangerouslySetInnerHTML` i
  similars. Fins i tot els marcadors del mapa es construeixen com a nodes del DOM.
- **Només JPEG**: les imatges que venen de la xarxa han de ser JPEG (comprovat per l’etiqueta i
  pels primers bytes). Un SVG pot portar codi; si es convertís en URL `blob:` d’aquesta web i
  s’obrís en una pestanya, podria fer servir les claus. Per això no s’accepten.
- **Llista blanca d’URL**: l’app només descarrega de `res.cloudinary.com/<el vostre compte>/`. Un
  membre no pot fer que els mòbils dels altres visitin una URL seva per saber-ne la IP.
- **Límits de mida** a cada descàrrega (1 MiB per entrada, 12 MiB per foto).
- **Sense galetes ni referrer** a les peticions a Cloudinary.
- **El mapa és nostre.** Les dades del mapa (un extracte de Protomaps/OpenStreetMap de la zona
  de l’event) són un fitxer servit des de la mateixa web, `map/area.pmtiles`. Cap servidor de
  mapes extern sap quina zona mira ningú, i la CSP no permet carregar tessel·les de fora.
- **Les fotos perden les metadades EXIF** (GPS original, model de càmera…) en redimensionar-les.
- **Validació estricta** de tot el que es desxifra: camps desconeguts fora, textos amb longitud
  màxima, dates i coordenades vàlides.

### 5. La cadena de subministrament

Un atacant també pot entrar per una dependència o pel procés de build.

- **pnpm amb `minimumReleaseAge: 4320`**: no s’instal·la cap versió publicada fa menys de 3 dies.
  La majoria de paquets maliciosos es detecten i retiren abans.
- **Scripts d’instal·lació desactivats** excepte per a `esbuild` i `@tailwindcss/oxide`
  (`onlyBuiltDependencies`, `strictDepBuilds`).
- **Lockfile obligatori** (`--frozen-lockfile`) i `pnpm audit` a cada canvi.
- **Accions de GitHub fixades per hash de commit**, amb permisos mínims per a cada feina.
- **CodeQL** (anàlisi estàtica) i **OpenSSF Scorecard** setmanals; **Dependabot** amb 3 dies
  d’espera.
- **ts-only**: el repositori no pot contenir JavaScript escrit a mà; tot passa pel tipatge
  estricte de TypeScript.
- **Components d’Untitled UI copiats sense cap canvi** (vegeu
  [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)), amb una ordre per comparar-los amb l’original.
- **El mapa es genera amb una eina fixada per versió** (`go-pmtiles` v1.31.2, verificada per la
  base de checksums de Go) i el fitxer resultant entra al manifest signat de cada desplegament.
- **Procedència del build**: cada desplegament genera `build-manifest.sha256` (el hash de cada
  fitxer publicat) i GitHub el signa amb una
  [atestació de build](https://docs.github.com/actions/security-guides/using-artifact-attestations).

### 6. La ubicació en viu (opcional)

- És un interruptor que cadascú activa o desactiva quan vol: per defecte, **desactivat**, i amagat
  del tot si l’organitzador no ha configurat aquesta funció.
- Mentre està activat, el teu mòbil envia la teva posició xifrada exactament igual que una foto:
  amb la mateixa clau del grup, signada amb la teva clau pròpia. Ningú la pot llegir ni
  fer-se passar per tu sense les teves claus.
- Es reparteix amb un servei extern, **Ably**, perquè arribi als altres mòbils sense passar per
  cap servidor nostre. Ably trasllada el missatge xifrat; no el pot desxifrar.
- **No es guarda enlloc.** Viu només a la memòria de cada mòbil, mentre dura la sessió. El punt
  d’algú es va esvaint i desapareixent als altres mòbils al cap d’uns minuts si deixa d’enviar-ne
  (tanca l’app, apaga l’interruptor, es queda sense cobertura).

### 7. Què es descarta en carregar

Les proves de `src/lib/repository.test.ts` i `src/lib/verify.test.ts` pugen deliberadament tot
això i comproven que no apareix:

- entrades xifrades amb una altra clau;
- fitxers que no són entrades;
- pisos signats per algú que no és l’organitzador;
- un esdeveniment amb una clau d’organitzador falsa;
- perfils que reclamen l’id d’una altra persona;
- fotos signades per algú diferent de l’autor que diuen tenir;
- fotos que apunten fora de Cloudinary;
- miniatures que no són JPEG;
- qualsevol entrada amb un sol byte canviat.

## El que no protegeix

Cap sistema és perfecte. Aquests són els límits coneguts, sense maquillatge.

**Sobre el grup**

1. **Qui té el QR ho té tot.** Pot veure totes les fotos i, mentre el preset de pujada existeixi,
   penjar-ne. No hi ha manera d’expulsar algú: caldria crear un event nou.
2. **Una captura del QR funciona per sempre, i qualsevol del grup la pot reenviar.** Si l’enllaç
   es reenvia, qui el rebi entra. El botó **Convida** ho fa més fàcil, però no ho fa possible: qui
   tenia el QR ja el podia reenviar.
3. **No hi ha secret cap endavant.** Si la clau es filtra demà, totes les fotos d’avui es poden
   llegir.
4. **Un membre pot omplir l’event de fotos** (seves), fins als límits de mida. No pot fer-ho en
   nom d’un altre.
5. **Ningú pot impedir que algú faci una captura de pantalla** d’una foto.

**Sobre els servidors**

6. **Cloudinary veu metadades**: IP de qui puja i consulta, hores, nombre i mida aproximada dels
   fitxers, i que tots els fitxers d’un mateix tag van junts. Pot **esborrar** fitxers o deixar de
   servir-los, i ningú se n’adonaria (no hi ha prova que hi siguin tots). No els pot llegir ni
   falsificar.
7. **Ably veu quan es connecta i envia senyals cadascú**, amb quina freqüència, encara que no en
   vegi el contingut. Si tens la ubicació en viu activada, algú que controlés el compte d’Ably
   sabria que ets a prop de l’event en aquella estona, no on exactament.
8. **Qui ja ha vist la teva posició, l’ha vista.** Desactivar l’interruptor fa que deixis d’enviar-
   ne de noves, però no esborra res de la memòria de qui ja l’havia rebut en aquell moment.
9. **Qui visita la web sap de quina ciutat és el mapa**: l’extracte del mapa és públic, com la
   resta de la web. Revela la zona general (per defecte, Barcelona), no els pisos: aquests van
   xifrats.
10. **El codi el serveix GitHub a cada visita.** Si algú controlés el compte de GitHub o el
    repositori, podria servir una versió que robés les fotos mentre la mires. És el límit de
    qualsevol aplicació web. El que es pot fer és **comprovar-ho**: l’atestació i el manifest
    permeten verificar que el que hi ha publicat ve d’un commit concret (vegeu més avall). El
    navegador, però, no ho comprova sol.

**Sobre el dispositiu**

11. **Un mòbil desbloquejat o infectat, o una extensió del navegador amb permisos sobre la web,
    poden fer servir les claus** mentre la pàgina està oberta. Les claus no exportables impedeixen
    que se les enduguin, no que les facin servir.
12. **El secret del grup queda desat al mòbil**, perquè es pugui tornar a ensenyar el QR. Un codi
    maliciós a la pàgina (vegeu el límit 10) podria llegir-lo i endur-se’l, en lloc de només fer
    servir la clau AES mentre la pàgina és oberta. A la pràctica la diferència és petita: aquest
    mateix codi ja podria llegir i enviar totes les fotos desxifrades. «Surt» l’esborra. A més,
    JavaScript no pot esborrar la memòria: el secret queda a la memòria fins que el navegador la
    reaprofita.
13. **El QR pot quedar guardat** a l’historial de l’app de la càmera o al xat on s’ha compartit.

**Sobre els detalls tècnics**

14. **El codi de seguretat només té 32 bits.** Serveix per detectar confusions entre amics, no
    contra algú amb recursos que generi milions de claus fins a trobar-ne una amb el mateix codi.
    L’identificador real té 128 bits.
15. **Les hores de les fotos les posa el mòbil de qui les penja.** No hi ha rellotge de
    confiança.
16. **Trusted Types no està activat**: Leaflet fa servir `innerHTML` per a la línia d’atribució del
    mapa. La resta de la CSP sí que s’aplica.
17. **`frame-ancestors` no es pot posar en una etiqueta `<meta>`**, i GitHub Pages no deixa
    enviar capçaleres. La web es podria incrustar en un iframe d’una altra web (clickjacking); no
    hi ha cap acció perillosa d’un sol clic, però cal saber-ho.
18. **Quan l’organitzador planifica l’itinerari** (`pnpm event:route`), el servei de rutes veu
    les coordenades dels pisos en aquell moment, des del seu ordinador: per defecte els servidors
    públics d’OpenStreetMap de FOSSGIS, o Google si ho tria. El resultat es xifra i se signa com la
    resta. La web i els mòbils dels amics no contacten mai cap d’aquests serveis. Les línies de
    metro (`metro.json`) són dades públiques d’OpenStreetMap i es publiquen amb la web.
19. **El fitxer de claus de l’organitzador** (`out/*.keys.json`) permet afegir pisos i llegir-ho
    tot. Es crea amb permisos `600`, però guardar-lo bé és responsabilitat de l’organitzador.

## Comprova-ho tu mateix

No t’ho creguis: prova-ho.

```sh
# 1. Les proves: xifratge, signatures i tot el que es descarta.
pnpm install --frozen-lockfile
pnpm test

# 2. Una implementació independent en Python obté els mateixos resultats que la web.
pip install cryptography && python3 scripts/verify_vectors.py

# 3. La web publicada ve d'aquest repositori: GitHub ho signa a cada desplegament.
curl -sO https://marcllobet.github.io/pis-stop/build-manifest.sha256
gh attestation verify build-manifest.sha256 --repo MarcLlobet/pis-stop

# 4. Cada fitxer servit coincideix amb el manifest signat.
curl -s https://marcllobet.github.io/pis-stop/index.html | sha256sum
grep ' index.html$' build-manifest.sha256

# 5. I el manifest coincideix amb el que surt de compilar el codi tu mateix
#    (amb les mateixes VITE_CLOUDINARY_* que el desplegament: són valors públics).
git checkout <commit del desplegament> && pnpm install --frozen-lockfile
pnpm build && pnpm manifest && diff dist/build-manifest.sha256 build-manifest.sha256
```

I des del navegador:

- **Eines de desenvolupador → Xarxa**: mentre penges una foto, mira què s’envia. Només veuràs
  peticions a Cloudinary amb un fitxer binari il·legible.
- **Eines de desenvolupador → Consola**: escriu `fetch('https://example.com')`. La CSP el
  bloqueja.
- **Aplicació → IndexedDB → pis-stop**: veuràs les claus com a objectes `CryptoKey` amb
  `extractable: false`.

## Decisions i alternatives descartades

- **Google Fotos o Instagram com a magatzem**: les seves API no permeten pujar a un compte compartit
  des del navegador sense exposar les credencials, i el proveïdor veuria les fotos.
- **Un codi curt per entrar (6 xifres)**: es pot endevinar provant-los tots. El QR permet una clau
  de 256 bits que ningú ha d’escriure.
- **Un QR que canviï cada minut**: sense servidor, el navegador hauria de conèixer el secret que
  els genera. No aportaria res.
- **Un backend amb usuaris i contrasenyes**: més superfície d’atac i més dades a guardar. Aquí no
  hi ha res a robar del servidor.
- **Un backend propi (p. ex. Supabase) per a la ubicació en viu**: hauríem d’escriure i mantenir
  servidor nostre per primera vegada, amb tot el que això implica. Amb Ably, i xifrant el missatge
  abans de sortir del mòbil com ja fem amb les fotos, arribem al mateix resultat sense cap
  servidor nou.

## Com reportar una vulnerabilitat

Fes-ho de manera privada a través de
[GitHub Security Advisories](https://github.com/MarcLlobet/pis-stop/security/advisories/new), no
en una issue pública. Explica com reproduir-ho; respondré tan aviat com pugui. També hi ha un
[`security.txt`](public/.well-known/security.txt) publicat a la web.
