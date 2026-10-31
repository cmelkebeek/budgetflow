// Applique le thème choisi avant le rendu, pour éviter un flash du mauvais thème.
// Fichier séparé (et non script en ligne) pour respecter la politique de sécurité du contenu (CSP).
try {
  var theme = localStorage.getItem('theme');
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
} catch (e) {}
