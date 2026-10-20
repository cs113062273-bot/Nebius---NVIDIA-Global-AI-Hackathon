import focusableSelectors from './focusable-selectors.js'

/**
 * Set the focus to the first element with `autofocus` with the element or the
 * element itself
 */
export function moveFocusToDialog(el             ) {
  const focused = (el.querySelector('[autofocus]') || el)               

  focused.focus()
}

// Get the first and last focusable elements in a given subtree
export function getFocusableEdges(el             ) {
  const first = findFocusableElement(el, true)
  let last = null
  if (first !== null) {
    last = findFocusableElement(el, false) || first
  }
  return [first, last]
}

function findFocusableElement(
  node             ,
  forward         
)                     {
  // If we're walking forward, check if this node is focusable,
  // and return it immediately if it is.
  if (forward && isFocusable(node)) {
    return node
  }

  // If this node can't have focusable children, there's no point
  // in checking its subtree, even if it it contains nodes that
  // would otherwise be focusable.
  if (!canHaveFocusableChildren(node)) {
    return null
  }

  // Start walking the DOM tree, looking for focusable elements.
  // Case 1: If this node has a shadow root, search it recursively.
  if (node.shadowRoot) {
    const shadowRoot = node.shadowRoot
    // Descend into this subtree.
    let next = getNextDescendantEl(shadowRoot, forward)
    // Traverse siblings, searching the subtree of each one
    // for focusable elements.
    while (next) {
      const focusableEl = findFocusableElement(next               , forward)
      if (focusableEl) return focusableEl
      next = getNextSiblingEl(next               , forward)
    }
    // Case 2: If this node is a slot for a Custom Element,
    // search its assigned nodes recursively.
  } else if (node.localName === 'slot') {
    const assignedElements = (node                   ).assignedElements({
      flatten: true,
    })                 
    if (!forward) assignedElements.reverse()
    for (const assignedElement of assignedElements) {
      const focusableEl = findFocusableElement(assignedElement, forward)
      if (focusableEl) return focusableEl
    }
    // Case 3: this is a regular Light DOM node. Search its subtree.
  } else {
    // Descend into this subtree.
    let next = getNextDescendantEl(node, forward)
    // Traverse siblings, searching the subtree of each one
    // for focusable elements.
    while (next) {
      const focusableEl = findFocusableElement(next               , forward)
      if (focusableEl) return focusableEl
      next = getNextSiblingEl(next               , forward)
    }
  }

  // If we're walking backward, we want to check the node's entire subtree
  // before checking the node itself.
  // If this node is focusable, return it.
  if (!forward && isFocusable(node)) return node

  return null
}

function getNextDescendantEl(node            , forward         ) {
  return forward ? node.firstElementChild : node.lastElementChild
}

function getNextSiblingEl(el             , forward         ) {
  return forward ? el.nextElementSibling : el.previousElementSibling
}

/**
 * Determine if an element is focusable and has user-visible painted dimensions
 */
export function isFocusable(el             ) {
  return (
    el.matches(focusableSelectors.join(',')) &&
    !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
  )
}

// Elements with these ARIA roles make their children `presentational`, which
// nullifies their semantics
// @see: https://www.w3.org/TR/wai-aria/
const PRESENTATIONAL_CHILDREN_SELECTOR = [
  'a[href]',
  'button',
  'img',
  'summary',
  '[role="button"]',
  '[role="image"]',
  '[role="link"]',
  '[role="math"]',
  '[role="presentation"]',
  '[role="progressbar"]',
  '[role="scrollbar"]',
  '[role="slider"]',
].join(',')

// Elemments matching these selectors are not available to the user.
// Neither they nor any of their descentants can ever receive focus.
const HIDDEN_FROM_USER_SELECTOR =
  ':disabled,[aria-disabled="true"],[aria-hidden="true"],[hidden],[inert]'

const cannotHaveFocusableChildrenSelector =
  PRESENTATIONAL_CHILDREN_SELECTOR + ',' + HIDDEN_FROM_USER_SELECTOR

/**
 * Determine if an element can have focusable children. Useful for bailing out
 * early when walking the DOM tree.
 * @example:
 * The following div is inert, so none of its children can be focused,
 * even though they meet our criteria for what is focusable.
 * Once we check the div, we can skip the rest of the subtree.
 * ```html
 * <div inert>
 *   <button>Button</button>
 *   <a href="#">Link</a>
 * </div>
 * ```
 * This is bad HTML. Links render their children presentaional, so
 * the nested link has no meaning to the user. We bail out on the
 * parent link so we don't mistakenly think the nested link is focusable.
 * ```html
 * <a href="#">
 *   Hello,
 *   <a href="#">world</a>
 * </a>
 * ```
 */
function canHaveFocusableChildren(el             ) {
  return !el.matches(cannotHaveFocusableChildrenSelector)
}

// Get the active element, accounting for Shadow DOM subtrees.
// @author Cory LaViska
// @see: https://www.abeautifulsite.net/posts/finding-the-active-element-in-a-shadow-root/
export function getActiveElement(
  root                        = document
)                 {
  const activeEl = root.activeElement

  if (!activeEl) return null

  // If there’s a shadow root, recursively find the active element within it.
  // If the recursive call returns null, return the active element of the top-level Document.
  if (activeEl.shadowRoot)
    return getActiveElement(activeEl.shadowRoot) || document.activeElement

  // If not, we can just return the active element
  return activeEl
}
