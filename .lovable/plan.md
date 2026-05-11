
## Tavoite

Tällä hetkellä `/dashboard` on käytännössä tyhjä käyttäjille (vain "Tervetuloa!" -teksti). Adminit saavat siellä koko yleisnäkymän. Ratkaisu: käyttäjät ohjataan suoraan **Oma ajoneuvo** -sivulle, ja sinne tuodaan kaksi uutta osiota, jotka tekevät sivusta oikean "kotinäkymän".

## Muutokset

### 1. Reititys & navigaatio
- `App.tsx`: Juurireitti `/` ohjaa adminit `/dashboard`-sivulle ja käyttäjät `/my-vehicle`-sivulle.
- `/dashboard`-reitti suojataan `requireAdmin`-lipulla, eli käyttäjä joka yrittää avata sen ohjataan automaattisesti omalle ajoneuvosivulleen.
- `AppSidebar.tsx`: "Yleisnäkymä"-linkki näkyy vain admineille. Käyttäjille sivupalkin ensimmäinen kohta on "Oma ajoneuvo".
- Dashboard.tsx-komponentista poistetaan turha non-admin -haara (ei käytetä enää).

### 2. Tehtävät / muistutukset (uusi kortti `MyVehicle`-sivun yläosaan)
Uusi komponentti `src/components/vehicles/UserTasksCard.tsx`. Näyttää käyttäjälle ajoneuvokohtaisesti vain ne kohdat, jotka vaativat toimenpiteitä — kortti piiloutuu kokonaan jos kaikki on kunnossa.

Mahdolliset tehtäväkortit:
- **Kirjaa kilometrit** — jos `useMileageDueStatus` palauttaa `due` tai `overdue`. Painikkeella scrollataan km-osioon tai avataan dialogi.
- **Suorita kuukausitarkastus** — jos `useInspectionDue` näyttää että tämän kuun tarkastus puuttuu. Linkki `/inspection`.
- **Lisää puhelinnumero** — jos `profile.phone` puuttuu. Avaa `ProfileDialog`.
- **Sopimus päättymässä** — jos `contract_end_date` < 60 päivää.
- **Sopimuskilometrit ylittymässä** — jos km > 90 % rajasta tai ennusteen mukaan ylittyy ennen sopimuksen loppua (käytä `use-mileage-prediction`).

Visuaali: pieni rivi per tehtävä (ikoni + lyhyt teksti + nappi), värikoodaus prioriteetin mukaan (warning / destructive). Useamman ajoneuvon tapauksessa näytetään ajoneuvon rekisterinumero rivin yhteydessä.

### 3. Aktiviteettiloki / historia (uusi osio sivun alaosaan)
Käytetään olemassa olevaa `VehicleActivityLog`-komponenttia (jota adminit jo käyttävät). Se näyttää aikajanana:
- km-merkinnät
- tehdyt kuukausitarkastukset

Lisäksi laajennetaan logia näyttämään käyttäjän omat **huoltokäynnit** (`service_visits`-taulu) ja **omat vauriotilmoitukset** (`damage_reports`-taulu) samalla aikajanalla. Useamman ajoneuvon käyttäjille näytetään yksi yhdistetty loki, jokaisessa rivissä rekisterinumero.

Loki rajataan oletuksena 10 viimeisimpään tapahtumaan + "Näytä lisää" -painike.

## Tekniset huomiot

- RLS sallii käyttäjän lukea omat km-merkinnät, tarkastukset, huoltokäynnit ja vauriotilmoitukset → ei tarvita uusia policyjä.
- Päivämäärät `pp/kk/vvvv`-muodossa olemassa olevalla `formatDate`-helperillä.
- Mobile-first: kortit pinotaan, napit täysleveitä pienillä näytöillä.
- Ei muutoksia tietokantaan eikä admin-näkymiin.

## Tiedostot joihin kosketaan

```text
src/App.tsx                                  (reititys)
src/components/AppSidebar.tsx                (linkin näkyvyys)
src/pages/Dashboard.tsx                      (poista user-haara)
src/pages/MyVehicle.tsx                      (lisää uudet osiot)
src/components/vehicles/UserTasksCard.tsx    (UUSI)
src/components/vehicles/VehicleActivityLog.tsx  (laajennus: huollot + vauriot)
```
