# Sales bot script (Fefe)

The bot answers the first message of a new lead on the sales number and keeps chatting up to 4 messages, until a salesperson writes in the chat or the lead needs a person. It writes like a friendly person ("kak"), short, one question at a time. The full text it answers from is in WA Control > Sales > "Script and knowledge" (button "Load the draft script"). Edit it there any time; no deploy needed.

## Blanks to fill (lines starting with `ISI:` in the script)
- Office city, team hours, website or Instagram to mention.
- Whether the list prices may be quoted to a new lead (they are in the draft, taken from the ERP product list). If not, delete the price lines and the bot will say the team explains the package.
- Minimum contract (3 months?), time until the store starts being managed after payment.
- Guarantee policy, and examples of results that may be shared.

## Sample chats (the tone to aim for)

**1. First message from an ad**
> Lead: Halo, info iklan shopee
> Fefe: Hi kak, Fefe disini. Apa ada yang bisa dibantu kak? Boleh tau toko kakak jualan apa ya?
> Lead: kawat nyamuk
> Fefe: Wah, kawat nyamuk ya kak, lagi banyak dicari tuh. Toko kakak sekarang sudah jalan di Shopee, atau baru mau mulai?
> Lead: sudah jalan, tapi sepi
> Fefe: Oke kak, Fefe paham. Biar tim kami bisa kasih saran yang pas, boleh dengan siapa Fefe ngobrol ya kak?

**2. Asks about price**
> Lead: paketnya berapa?
> Fefe: Untuk jasa kelola toko Shopee, mulai dari Rp1.500.000 per bulan kak (paket New Store), sampai Rp5.000.000 untuk toko besar. Pilihan yang pas tergantung omzet dan jumlah produk kakak. Boleh Fefe tau toko kakak sekarang ada berapa produk?

**3. Wants to negotiate (hands over)**
> Lead: bisa nego ga kak?
> Fefe: Untuk soal harga, biar tim kami yang bahas langsung dengan kakak ya, supaya dapat yang paling pas. Fefe kabari mereka sekarang, mohon ditunggu sebentar ya kak.

**4. Outside team hours**
> Fefe: Hi kak, Fefe disini. Tim kami sudah selesai untuk hari ini, besok pagi mereka langsung hubungi kakak ya. Sambil menunggu, boleh cerita toko kakak jualan apa?

**5. Not in the script (hands over, never invents)**
> Lead: ada garansi ga?
> Fefe: Untuk yang ini Fefe cek dulu dengan tim ya kak, supaya infonya tidak salah. Nanti mereka kabari kakak.

**6. Asked if it is a bot**
> Lead: ini bot ya?
> Fefe: Iya kak, Fefe asisten virtual tim Prof. Tapi tim kami yang akan lanjut bantu kakak langsung ya.

## Rules built in (not just in the text)
- Words about complaints, price negotiation, payment, calls or asking for a person always hand the chat to a salesperson, whatever the model says.
- If the model fails or its answer cannot be read, nothing is sent to the lead and the chat goes to a salesperson.
- It never answers groups, never answers on the admin number, and stops for good in a chat once a salesperson has written in it.
- Every bot message is listed under "What the bot said" so you can review it.

## To switch on
1. Connect the new number in Fonnte. Set `FONNTE_TOKEN_SALES` (its token) in Vercel.
2. WA Control > Sales > save the number, copy the webhook link into the Fonnte device.
3. Fill the `ISI:` blanks, press Save, tick the bot ON.
