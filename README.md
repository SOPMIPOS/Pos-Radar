# Pantau Cawangan — deploy ke Netlify

Dashboard ini menanda cawangan Pos (PLC/DC) yang terjejas oleh amaran cuaca MET,
amaran paras air JPS dan IPU tidak sihat (APIMS), bersama semua poskod di bawah
cawangan itu. Butang **Kemas kini data** menarik data terkini terus dari sumber rasmi.

## Kandungan folder

| Fail | Fungsi |
|---|---|
| `index.html` | Ringkasan: senarai cawangan terjejas, peta, semak poskod, laporan WhatsApp |
| `cawangan.html` | Pecahan negeri → cawangan → butiran (sebab, daerah, poskod ikut SLA), muat turun CSV poskod terjejas. Pautan boleh dikongsi, cth. `cawangan.html#negeri=Johor&cawangan=Segamat%20(PLC)` |
| `core.js` | Enjin data bersama (tarikan, padanan, pengiraan) untuk kedua-dua halaman |
| `style.css` | Gaya bersama |
| `pos-data.js` | 96 outlet, julat poskod + SLA, dan pemetaan daerah → cawangan (daripada Postcode Listing) |
| `netlify/functions/data.mjs` | Fungsi pelayan `/api/data`: menarik MET, APIMS dan JPS, menyimpan satu salinan untuk semua pengguna (Netlify Blobs), dan menguatkuasakan had kemas kini 30 minit |
| `package.json` | Pakej `@netlify/blobs` untuk fungsi di atas |
| `netlify.toml` | Tetapan Netlify |

## Cara deploy (pilih satu)

**Jangan guna drag-and-drop.** Netlify Drop tidak menjalankan fungsi, jadi data tidak dikongsi,
had 30 minit hanya untuk pelayar masing-masing, dan IPU serta JPS tidak dapat ditarik.

### A. Netlify CLI (paling cepat)
```bash
npm install -g netlify-cli
netlify login
cd pantau-cawangan
npm install          # pasang @netlify/blobs (sekali sahaja)
netlify deploy --prod
```
Bila ditanya, pilih "Create & configure a new site". Publish directory: `.`

### B. GitHub
1. Muat naik folder ini ke repo GitHub baharu.
2. Netlify → Add new site → Import an existing project → pilih repo.
3. Build command: kosongkan. Publish directory: `.` → Deploy. (Netlify memasang `@netlify/blobs` secara automatik daripada `package.json`.)

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

## Nota penggunaan

- **Had kemas kini 30 minit untuk semua pengguna.** Bila sesiapa menekan "Kemas kini data", butang dikunci untuk semua orang selama 30 minit dan menunjukkan baki minit. Had ini dikuatkuasakan di pelayan, jadi tidak boleh dielak dengan muat semula halaman atau pelayar lain.
- Semua pengguna melihat data yang sama. Halaman yang sedang dibuka menyemak setiap 2 minit dan memaparkan data baharu secara automatik bila pengguna lain mengemas kini.
- Kali pertama selepas deploy (belum ada data), data ditarik sekali secara automatik.
- Jika semua sumber gagal semasa kemas kini, butang tidak dikunci dan data terakhir kekal dipaparkan.
- Sejarah IPU 7 hari disimpan di pelayan (sama untuk semua). Sejarah JPS dikumpul dalam pelayar setiap pengguna.
- Pilihan tempoh (Sekarang / Hari ini / 7 hari) dikongsi antara kedua-dua halaman.
- CSV mengandungi setiap poskod di bawah cawangan terjejas: Poskod, Cawangan, Negeri, SLA, Tahap, Sebab. Dibuka terus dalam Excel.

## Had yang perlu diketahui

- Satu cawangan meliputi beberapa daerah, jadi semua poskod cawangan ditanda bila mana-mana
  daerahnya terjejas.
- Jalan ditutup (JKR Bencana Alam) belum ditarik secara automatik.
- Format halaman JPS boleh berubah tanpa notis; jika status JPS gagal, semak terus
  di publicinfobanjir.water.gov.my/cerapan/amaran-semasa/.
- Untuk kemas kini senarai poskod/cawangan, hantar Postcode Listing baharu dan jana semula
  `pos-data.js`.
