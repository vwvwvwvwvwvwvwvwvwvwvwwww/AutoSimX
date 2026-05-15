/** Общие данные сайта. Подключается перед shell.js. */
window.AUTOSIM_SITE = {
  /** Префикс для фото с официального сайта (см. https://auto-sim.ru/) */
  mediaBase: "https://auto-sim.ru",
  brand: { shortMark: "AS", name: "AutoSimX" },
  phone: { href: "tel:+79510308856", display: "+7 (951) 030-88-56" },
  links: {
    telegram: "https://t.me/autosimx",
    vk: "https://vk.com/autosimx",
    instagram: "https://www.instagram.com/autosimx?igsh=MXNqbjZsMGZmdjFhZQ==",
    map2gis: "https://2gis.ru/orenburg/firm/70000001099814962?m=55.159505%2C51.828696%2F16",
    yandexReviews:
      "https://yandex.ru/maps/org/avtosim/150925722450/reviews/?indoorLevel=1&ll=55.159451%2C51.828615&tab=reviews&z=16.91",
    official: "https://auto-sim.ru/",
  },
  nav: [
    { page: "home", href: "index.html", label: "Главная" },
    { page: "about", href: "about.html", label: "О клубе" },
    { page: "gallery", href: "gallery.html", label: "Галерея" },
    { page: "prices", href: "prices.html", label: "Цены" },
    { page: "reviews", href: "reviews.html", label: "Отзывы" },
    { page: "equipment", href: "equipment.html", label: "Оборудование" },
    { page: "visit", href: "visit.html", label: "Как добраться" },
    { page: "contact", href: "contact.html", label: "Контакты" },
  ],
  footerNote: "Информация на сайте носит справочный характер. Актуальные цены и условия уточняйте в клубе.",
  authLinks: {
    login: "login.html",
    register: "register.html",
  },
};
