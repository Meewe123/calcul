import './styles/not-found.css';

// Prints the address that was not found on the slip, as text (never as HTML).
const path = document.getElementById('lost-path');
if (path) path.textContent = decodeURI(location.pathname);
