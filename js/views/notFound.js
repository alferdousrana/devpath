import { empty } from "../components/ui.js";
export default function notFound({ el }) {
  el.innerHTML = empty("Page not found", "That address doesn't match any page in DevPath.", `<a class="btn" href="#/dashboard">Go to Today</a>`);
}
