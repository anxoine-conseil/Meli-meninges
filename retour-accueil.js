// Quand un jeu est ouvert seul (depuis Google ou un lien partagé), un bandeau ramène au cabinet de tous les jeux.
(function () {
  var inFrame = false; try { inFrame = window.self !== window.top; } catch (e) { inFrame = true; }
  if (inFrame) return;
  // Statistiques de fréquentation (Umami, sans cookie) : seulement quand le jeu est ouvert seul, pour ne pas compter deux fois.
  var u = document.createElement('script'); u.defer = true; u.src = 'https://cloud.umami.is/script.js';
  u.setAttribute('data-website-id', 'd3fcb17e-2f90-43fc-babc-f3997557076d'); u.setAttribute('data-domains', 'meli-meninges.fr,www.meli-meninges.fr');
  document.head.appendChild(u);
  var a = document.createElement('a');
  a.href = 'index.html';
  a.textContent = '← Retour à tous les jeux Méli-Méninges (gratuits)';
  a.style.cssText = 'display:block;margin:0 0 10px;padding:12px 16px;min-height:44px;box-sizing:border-box;background:#2f5d3a;color:#fff;font:700 16px/1.3 system-ui,-apple-system,"Segoe UI",sans-serif;text-decoration:none;border-radius:12px;text-align:center';
  document.body.insertBefore(a, document.body.firstChild);
})();
