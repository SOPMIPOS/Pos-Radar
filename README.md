# Pantau Cawangan — deploy ke Netlify

Dashboard ini menanda cawangan Pos (PLC/DC) yang terjejas oleh amaran cuaca MET,
amaran paras air JPS dan IPU tidak sihat (APIMS), bersama semua poskod di bawah
cawangan itu. Butang **Kemas kini data** menarik data terkini terus dari sumber rasmi.

## Kandungan folder

| Fail | Fungsi |
|---|---|
| `index.html` | Dashboard |
| `pos-data.js` | 96 outlet, julat poskod + SLA, dan pemetaan daerah → cawangan (daripada Postcode Listing) |
| `netlify/functions/proxy.mjs` | Proxy kecil supaya pelayar boleh baca laman JPS dan APIMS (sekatan CORS) |
| `netlify.toml` | Tetapan Netlify |

## Cara deploy (pilih satu)

**Jangan guna drag-and-drop.** Netlify Drop tidak menjalankan fungsi, jadi IPU dan JPS
tidak akan dapat ditarik (amaran MET masih berfungsi).

### A. Netlify CLI (paling cepat)
```bash
npm install -g netlify-cli
netlify login
cd pantau-cawangan
netlify deploy --prod
```
Bila ditanya, pilih "Create & configure a new site". Publish directory: `.`

### B. GitHub
1. Muat naik folder ini ke repo GitHub baharu.
2. Netlify → Add new site → Import an existing project → pilih repo.
3. Build command: kosongkan. Publish directory: `.` → Deploy.

Selepas deploy, buka laman dan semak tiga titik status di bahagian atas (MET, APIMS, JPS)
semuanya hijau.

## Cara cawangan ditanda terjejas

- **Amaran MET** (data.gov.my): nama negeri/daerah dalam teks amaran dipadankan dengan
  daerah setiap cawangan. Daerah dipetakan ke cawangan menggunakan poskod bandar utama
  setiap daerah dalam Postcode Listing. Buletin laut dan nasihat siklon diabaikan.
- **IPU** (APIMS): stesen > 100 menanda cawangan dalam radius 20 km (jika tiada, cawangan
  terdekat sehingga 60 km). >100 Waspada, >150 Buruk, >200 Bahaya.
- **JPS** (Public Infobanjir, Amaran Semasa): stesen Waspada/Amaran/Bahaya dipadankan
  melalui nama daerah lokasi stesen.
- Tempoh **Sekarang / Hari ini / 7 hari**: amaran MET 7 hari ditarik setiap kali.
  IPU dan JPS hanya ada bacaan semasa — sejarahnya dikumpul dalam pelayar setiap kali
  butang ditekan.

## Had yang perlu diketahui

- Satu cawangan meliputi beberapa daerah, jadi semua poskod cawangan ditanda bila mana-mana
  daerahnya terjejas.
- Jalan ditutup (JKR Bencana Alam) belum ditarik secara automatik.
- Format halaman JPS boleh berubah tanpa notis; jika status JPS gagal, semak terus
  di publicinfobanjir.water.gov.my/cerapan/amaran-semasa/.
- Untuk kemas kini senarai poskod/cawangan, hantar Postcode Listing baharu dan jana semula
  `pos-data.js`.
