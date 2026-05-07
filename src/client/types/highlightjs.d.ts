declare module "highlight.js/lib/core" {
  import hljs from "highlight.js";
  export default hljs;
}

declare module "highlight.js/lib/languages/*" {
  const language: any;
  export default language;
}
