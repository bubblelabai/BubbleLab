/**
 * Monkey patch DOM methods to prevent Google Translate from breaking React
 *
 * Google Translate modifies the DOM by wrapping text nodes in <font> tags,
 * which breaks React's virtual DOM reconciliation and causes errors like:
 * "Failed to execute 'insertBefore' on 'Node': The node before which the new node is to be inserted is not a child of this node"
 *
 * This polyfill catches these errors and handles them gracefully.
 * Based on solutions from: https://github.com/facebook/react/issues/11538
 */

let isPatched = false;

export function patchDOMForGoogleTranslate(): void {
  // Only patch once
  if (isPatched) return;

  if (typeof Node === 'undefined' || !Node.prototype) {
    console.warn('DOM Node API not available, skipping Google Translate fix');
    return;
  }

  // Patch removeChild
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      if (console && console.warn) {
        console.warn(
          'Google Translate Error: Cannot remove a child from a different parent',
          child,
          this
        );
      }
      return child;
    }
    return originalRemoveChild.apply(this, [child]) as T;
  };

  // Patch insertBefore
  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(
    newNode: T,
    referenceNode: Node | null
  ): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console && console.warn) {
        console.warn(
          'Google Translate Error: Cannot insert before a reference node from a different parent',
          newNode,
          referenceNode,
          this
        );
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, [newNode, referenceNode]) as T;
  };

  isPatched = true;
}
