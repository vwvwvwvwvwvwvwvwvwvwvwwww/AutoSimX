"use strict";

/** Базовый публичный контент по умолчанию (до правок администратора). */
function defaultPublicSite() {
  return {
    site: {
      brand: { shortMark: "AS", name: "AutoSimX" },
      phone: { href: "tel:+79510308856", display: "+7 (951) 030-88-56" },
      links: {
        telegram: "https://t.me/autosimx",
        vk: "https://vk.com/autosimx",
        instagram: "https://www.instagram.com/autosimx?igsh=MXNqbjZsMGZmdjFhZQ==",
        map2gis:
          "https://2gis.ru/orenburg/firm/70000001099814962?m=55.159505%2C51.828696%2F16",
        yandexReviews:
          "https://yandex.ru/maps/org/avtosim/150925722450/reviews/?indoorLevel=1&ll=55.159451%2C51.828615&tab=reviews&z=16.91",
        official: "https://auto-sim.ru/",
      },
      footerNote:
        "Информация на сайте носит справочный характер. Актуальные цены и условия уточняйте в клубе.",
    },
    homeHero: {
      eyebrow: "Оренбург · ул. Рыбаковская, 59 · ежедневно 14:00 — 02:00",
      promoLead: "Новым гостям — ",
      promoBold: "500 ₽",
      promoNote: " на первый заезд ",
      promoSuffix: "(акция клуба)",
      titleLine1: "Автосим для тех,",
      titleBefore: "кто ",
      titleHighlight: "гоняет",
      tagline:
        "а не «просто поиграть» — кольцо, дрифт, ралли, F1 и VR на профессиональном железе.",
      lead:
        "Профессиональные кокпиты, сеть до 6 пилотов, режимы под любой уровень — от первого заезда до тренировки круга.",
      ctaBook: "Забронировать",
      ctaVk: "ВКонтакте",
      statModeLabel: "Режим",
      statModeValue: "14:00 — 02:00",
      statAddrLabel: "Адрес",
      statAddrValue: "Рыбаковская 59",
      statGuestsLabel: "Гости",
      statGuestsValue: "5★ отзывы",
    },
  };
}

module.exports = { defaultPublicSite };
