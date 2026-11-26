"use client";

import { useEffect } from "react";

/**
 * Liga a luz que segue o mouse nos cartões ".glass-hover" e o leve "levantar"
 * dos que têm data-lift. Um único ouvinte para a página inteira.
 */
export function GlassSpotlight() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let current: HTMLElement | null = null;

    function reset(card: HTMLElement | null) {
      if (card) card.style.transform = "";
    }

    function onMove(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      const card = (event.target as Element | null)?.closest?.<HTMLElement>(".glass-hover") ?? null;
      if (card !== current) {
        reset(current);
        current = card;
      }
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      card.style.setProperty("--mx", `${x}px`);
      card.style.setProperty("--my", `${y}px`);
      // Só um leve "levantar": inclinação 3D com vidro desfocado deixa manchas no Chrome.
      if (card.dataset.lift !== undefined && !reduceMotion) card.style.transform = "translateY(-3px)";
    }

    function onLeave() {
      reset(current);
      current = null;
    }

    document.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return null;
}
