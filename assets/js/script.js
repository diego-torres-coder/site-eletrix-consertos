// Eletrix Consertos — comportamento do menu mobile e do accordion de FAQ (Alpine.js)

document.addEventListener('alpine:init', () => {
  Alpine.data('siteHeader', () => ({
    menuOpen: false,
    toggleMenu() {
      this.menuOpen = !this.menuOpen;
    },
    closeMenu() {
      this.menuOpen = false;
    }
  }));

  Alpine.data('faqAccordion', () => ({
    openIndex: null,
    toggle(i) {
      this.openIndex = this.openIndex === i ? null : i;
    },
    isOpen(i) {
      return this.openIndex === i;
    }
  }));
});
