
# Push-ilmoitukset puhelimeen

Push-ilmoitusten toteuttaminen vaatii useita osia: PWA-asennus (jotta sovellus voidaan asentaa puhelimeen), Service Worker, Push API ja backend-logiikka ilmoitusten lähettämiseen.

## Yleiskuva

Käyttäjät saavat push-ilmoituksia puhelimeensa esimerkiksi:
- Maanantaiaamuna muistutus kilometrikirjauksesta
- Kuukauden ensimmäisenä arkipäivänä muistutus kuukausitarkastuksesta
- Admin voi myöhemmin lähettää manuaalisia ilmoituksia

## Toteutussuunnitelma

### Vaihe 1: PWA-asennus (vite-plugin-pwa)
- Asennetaan `vite-plugin-pwa`-paketti
- Konfiguroidaan `vite.config.ts` manifest-tiedoilla (sovelluksen nimi, ikonit, värit)
- Lisätään `index.html`:iin mobiili-meta-tagit (theme-color, apple-mobile-web-app jne.)
- Luodaan PWA-ikonit `public/`-kansioon (192x192 ja 512x512)
- Tämä mahdollistaa sovelluksen asentamisen puhelimen kotinäytölle

### Vaihe 2: Push-tilausten hallinta (tietokanta)
- Luodaan uusi `push_subscriptions`-taulu tietokantaan:
  - `id`, `user_id`, `endpoint`, `p256dh`, `auth`, `created_at`
  - RLS: käyttäjät voivat lisätä/poistaa omia tilauksiaan, adminit näkevät kaikki
- Tämä tallentaa jokaisen käyttäjän selaimen push-tilauksen tiedot

### Vaihe 3: VAPID-avaimet ja salaisuudet
- Generoidaan VAPID-avainpari (julkinen + yksityinen) push-ilmoituksia varten
- Julkinen avain tallennetaan koodiin (turvallista)
- Yksityinen avain tallennetaan salaisuutena backendiin
- VAPID-avaimet ovat Web Push -standardin vaatima tunnistautumismenetelmä

### Vaihe 4: Frontend - Push-tilauksen rekisteröinti
- Luodaan `usePushNotifications`-hook joka:
  - Tarkistaa tukeeko selain push-ilmoituksia
  - Pyytää käyttäjältä luvan ilmoituksiin
  - Rekisteröi push-tilauksen Service Workeriin
  - Tallentaa tilauksen tietokantaan
- Lisätään käyttöliittymään toggle "Ilmoitukset päälle/pois" (esim. profiilivalikkoon tai asetuksiin)

### Vaihe 5: Backend - Ilmoitusten lähetys (Edge Function)
- Luodaan `send-push-notification` Edge Function joka:
  - Hakee käyttäjien push-tilaukset tietokannasta
  - Lähettää Web Push -ilmoitukset käyttäen `web-push`-kirjastoa
  - Tukee eri ilmoitustyyppejä (kilometrimuistutus, tarkastusmuistutus)
- Service Worker vastaanottaa ilmoituksen ja näyttää sen puhelimessa

### Vaihe 6: Ajastetut ilmoitukset (Cron)
- Luodaan tietokantaan cron-tehtävä joka kutsuu Edge Functionia:
  - **Maanantaiaamuna klo 8**: tarkistaa ketkä eivät ole kirjanneet kilometrejä ja lähettää muistutuksen
  - **Kuukauden 1. arkipäivänä klo 8**: muistutus kuukausitarkastuksesta
- Cron käyttää `pg_cron` + `pg_net` -laajennuksia

## Tekninen yhteenveto

```text
Käyttäjä avaa sovelluksen
    |
    v
PWA Service Worker rekisteröityy
    |
    v
"Haluatko ilmoituksia?" -> Käyttäjä hyväksyy
    |
    v
Push-tilaus tallennetaan tietokantaan
    |
    v
Cron (ma klo 8) -> Edge Function
    |
    v
Edge Function hakee tilaukset + tarkistaa kirjaukset
    |
    v
Web Push -> Puhelimen lukitusnäyttö: "Muista kirjata kilometrit!"
```

## Huomioita
- Push-ilmoitukset toimivat vain jos käyttäjä on asentanut sovelluksen kotinäytölle (tai käyttää Chromea Androidilla)
- iPhonella push-ilmoitukset vaativat iOS 16.4+ ja sovelluksen asentamisen kotinäytölle
- Käyttäjän on annettava lupa ilmoituksiin erikseen
- Toteutukseen tarvitaan VAPID-yksityisavain, joka generoidaan ja tallennetaan salaisuutena
