"use strict";(self.webpackChunkpikachu_volleyball=self.webpackChunkpikachu_volleyball||[]).push([[831],{830:()=>{function e(e){document.documentElement.dataset.colorScheme=e;const c=document.querySelector('meta[name="theme-color"]');null!==c&&c.setAttribute("content","dark"===e?"#202124":"#FFFFFF")}!function(){const c=Array.from(document.getElementsByClassName("dark-color-scheme-checkbox"));let o=null;try{o=window.localStorage.getItem("colorScheme")}catch(e){console.error(e)}if("dark"===o||"light"===o)c.forEach((e=>{e.checked="dark"===o})),e(o);else{const o=window.matchMedia("(prefers-color-scheme: dark)").matches;e(o?"dark":"light"),c.forEach((e=>{e.checked=o}))}c.forEach((o=>{o.addEventListener("change",(()=>{const t=o.checked?"dark":"light";e(t);try{window.localStorage.setItem("colorScheme",t)}catch(e){console.error(e)}c.forEach((e=>{e!==o&&(e.checked=o.checked)}))}))}))}()}},e=>{e(e.s=830)}]);
//# sourceMappingURL=dark_color_scheme.bundle.js.map