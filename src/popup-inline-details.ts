/** Keep analysis after the current native perk section, including its Aegis footer. */
export function placeInlinePopupDetails(popup: HTMLElement, card: HTMLElement) {
  const native = (node: Element) => !node.closest('.aegis-popup-details-card, .aegis-popup-summary, .aegis-compare-panel, .aegis-overview-footer');
  // The native layout button remains inside the whole socket section in both
  // grid and list views. Titles also match Aegis controls and are localized.
  const layoutIcon = [...popup.querySelectorAll('button .fa-th, button .fa-list')].find(native);
  let target = layoutIcon?.closest('button')?.parentElement;
  if (!target) {
    target = [...popup.querySelectorAll<HTMLElement>('[class*="sockets" i]')].find(native);
  }
  if (target && !target.contains(card)) {
    // The footer holds masterwork recommendations and the activity switch.
    while (target.nextElementSibling?.matches('.aegis-overview-footer, .aegis-masterwork-recommendations')) {
      target = target.nextElementSibling as HTMLElement;
    }
    if (target.nextElementSibling !== card) target.after(card);
    return;
  }
  // During a React replacement, keep the card at the end of the content body.
  // Never insert after the popup itself or into the recommendations toolbar.
  const body = [...popup.querySelectorAll<HTMLElement>('.gi12X5mX, [class*="ItemPopup-m_desktopPopupBody-"], [class*="ItemDetails" i], [class*="item-details" i], [class*="body" i], [class*="content" i]')]
    .find(node => native(node) && node !== card && !card.contains(node)) || popup;
  if (body.lastElementChild !== card) body.append(card);
}
