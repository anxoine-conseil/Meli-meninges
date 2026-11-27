// Quand un jeu est ouvert seul (depuis Google ou un lien partagé), un bandeau ramène au cabinet de tous les jeux.
(function () {
  var inFrame = false; try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
  if (inFrame) return;
  var a = document.createElement('a');
  a.href = 'index.html';
  a.textContent = '← Méli-Méninges : tous les jeux gratuits';
  a.style.cssText = 'display:block;margin:0 0 10px;padding:12px 16px;min-height:44px;box-sizing:border-box;background:#2f5d3a;color:#fff;font:700 16px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;text-decoration:none;border-radius:12px;text-align:center';
  document.body.insertBefore(a, document.body.firstChild);
})();
