// js/ui-feedback.js - Modern In-App Toast & Modal Feedback System (Requirement R1)

/**
 * Toast Feedback Engine
 */
export const uiToast = {
  _getContainer() {
    if (typeof document === "undefined") return null;
    let container = document.getElementById("toastContainer") || document.getElementById("toast-container");
    if (!container && document.body) {
      container = document.createElement("div");
      container.id = "toastContainer";
      container.setAttribute("aria-live", "polite");
      container.className = "fixed top-4 right-4 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0";
      document.body.appendChild(container);
    }
    return container;
  },

  show({ message, title = "", type = "info", duration = 3500, actionText = "", onAction = null }) {
    const msgString = String(message ?? "");

    // Backward compatibility: keep test harnesses and legacy inspectors updated
    if (typeof window !== "undefined") {
      window._lastAlert = msgString;
      if (typeof window._openWindows !== "undefined") {
        // mockWindow environment
        window._lastAlert = msgString;
      }
    }
    if (typeof globalThis !== "undefined" && globalThis.window) {
      globalThis.window._lastAlert = msgString;
    }

    const container = this._getContainer();
    if (!container || typeof document === "undefined") {
      return null;
    }

    // Color and icon styles based on type
    const styles = {
      success: {
        border: "border-emerald-500/30",
        shadow: "shadow-emerald-500/10",
        iconBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
        icon: "check_circle",
        barBg: "bg-emerald-500",
        defaultTitle: "Éxito"
      },
      error: {
        border: "border-rose-500/30",
        shadow: "shadow-rose-500/10",
        iconBg: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
        icon: "error",
        barBg: "bg-rose-500",
        defaultTitle: "Error"
      },
      warning: {
        border: "border-amber-500/30",
        shadow: "shadow-amber-500/10",
        iconBg: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
        icon: "warning",
        barBg: "bg-amber-500",
        defaultTitle: "Atención"
      },
      info: {
        border: "border-primary/30",
        shadow: "shadow-primary/10",
        iconBg: "bg-primary/15 text-primary dark:bg-primary/30 dark:text-primary-fixed",
        icon: "info",
        barBg: "bg-primary",
        defaultTitle: "Información"
      }
    };

    const style = styles[type] || styles.info;
    const toastTitle = title || (type === "error" ? "Error" : "");

    const toast = document.createElement("div");
    toast.className = `pointer-events-auto bg-surface-container-lowest text-on-surface p-3.5 rounded-2xl shadow-xl border ${style.border} ${style.shadow} flex flex-col gap-2 transition-all duration-300 transform translate-y-[-10px] opacity-0 relative overflow-hidden`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.setAttribute("aria-live", "polite");

    // Format newlines safely
    const formattedMsg = msgString
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br/>");

    toast.innerHTML = `
      <div class="flex items-start gap-3 w-full">
        <div class="w-8 h-8 rounded-xl ${style.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5">
          <span class="material-symbols-outlined text-[18px]">${style.icon}</span>
        </div>
        <div class="flex-1 min-w-0 pr-1">
          ${toastTitle ? `<h4 class="font-headline-sm text-xs font-bold text-on-surface leading-tight mb-0.5">${toastTitle}</h4>` : ""}
          <div class="font-body-sm text-xs text-on-surface-variant leading-relaxed break-words">${formattedMsg}</div>
        </div>
        <button class="toast-close-btn w-6 h-6 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-surface-container flex items-center justify-center flex-shrink-0 transition-colors" aria-label="Cerrar notificación">
          <span class="material-symbols-outlined text-[16px]">close</span>
        </button>
      </div>
      ${actionText ? `
        <div class="flex justify-end pt-1">
          <button class="toast-action-btn px-3 py-1 rounded-xl bg-surface-container-high hover:bg-primary hover:text-on-primary text-primary text-xs font-bold transition-colors">
            ${actionText}
          </button>
        </div>
      ` : ""}
      ${duration > 0 ? `
        <div class="toast-progress absolute bottom-0 left-0 right-0 h-0.5 bg-surface-container-high overflow-hidden">
          <div class="toast-progress-bar h-full ${style.barBg} transition-all" style="width: 100%;"></div>
        </div>
      ` : ""}
    `;

    container.appendChild(toast);

    // Trigger entrance animation
    setTimeout(() => {
      if (toast.classList) {
        toast.classList.remove("translate-y-[-10px]", "opacity-0");
        toast.classList.add("translate-y-0", "opacity-100");
      }
    }, 15);

    let dismissTimeout = null;
    let startTime = Date.now();
    let remainingTime = duration;
    let isPaused = false;

    const dismiss = () => {
      if (dismissTimeout) clearTimeout(dismissTimeout);
      if (toast.classList) {
        toast.classList.remove("translate-y-0", "opacity-100");
        toast.classList.add("opacity-0", "translate-y-[-10px]", "scale-95");
      }
      setTimeout(() => {
        if (toast.remove) toast.remove();
        else if (toast.parentNode && toast.parentNode.removeChild) toast.parentNode.removeChild(toast);
      }, 250);
    };

    const startTimer = (ms) => {
      if (duration <= 0) return;
      startTime = Date.now();
      dismissTimeout = setTimeout(dismiss, ms);

      const progressBar = toast.querySelector ? toast.querySelector(".toast-progress-bar") : null;
      if (progressBar && progressBar.style) {
        progressBar.style.transition = `width ${ms}ms linear`;
        progressBar.style.width = "0%";
      }
    };

    const pauseTimer = () => {
      if (duration <= 0 || isPaused) return;
      isPaused = true;
      clearTimeout(dismissTimeout);
      const elapsed = Date.now() - startTime;
      remainingTime = Math.max(200, remainingTime - elapsed);

      const progressBar = toast.querySelector ? toast.querySelector(".toast-progress-bar") : null;
      if (progressBar && progressBar.style) {
        const percent = Math.max(0, (remainingTime / duration) * 100);
        progressBar.style.transition = "none";
        progressBar.style.width = `${percent}%`;
      }
    };

    const resumeTimer = () => {
      if (duration <= 0 || !isPaused) return;
      isPaused = false;
      startTimer(remainingTime);
    };

    // Close button click
    const closeBtn = toast.querySelector ? toast.querySelector(".toast-close-btn") : null;
    if (closeBtn && closeBtn.addEventListener) {
      closeBtn.addEventListener("click", (e) => {
        if (e.stopPropagation) e.stopPropagation();
        dismiss();
      });
    }

    // Action button click
    if (actionText && onAction) {
      const actionBtn = toast.querySelector ? toast.querySelector(".toast-action-btn") : null;
      if (actionBtn && actionBtn.addEventListener) {
        actionBtn.addEventListener("click", (e) => {
          if (e.stopPropagation) e.stopPropagation();
          try {
            onAction();
          } catch (err) {
            console.error("Toast action error:", err);
          }
          dismiss();
        });
      }
    }

    // Hover pause behavior
    if (duration > 0 && toast.addEventListener) {
      toast.addEventListener("mouseenter", pauseTimer);
      toast.addEventListener("mouseleave", resumeTimer);
    }

    startTimer(duration);
    return toast;
  },

  success(message, title = "") {
    return this.show({ message, title, type: "success" });
  },

  error(message, title = "") {
    return this.show({ message, title, type: "error" });
  },

  warning(message, title = "") {
    return this.show({ message, title, type: "warning" });
  },

  info(message, title = "") {
    return this.show({ message, title, type: "info" });
  }
};

/**
 * Promise-based In-App Modal Dialog Engine
 */
export const uiModal = {
  _getContainer() {
    if (typeof document === "undefined") return null;
    let container = document.getElementById("uiModalContainer") || document.getElementById("ui-modal-container");
    if (!container && document.body) {
      container = document.createElement("div");
      container.id = "uiModalContainer";
      container.className = "fixed inset-0 z-50 pointer-events-none flex items-center justify-center";
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Confirmation Dialog
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  confirm({
    title = "Confirmación",
    message = "¿Deseas continuar?",
    confirmText = "Aceptar",
    cancelText = "Cancelar",
    type = "primary", // 'primary' | 'danger'
    icon = null
  } = {}) {
    return new Promise((resolve) => {
      const container = this._getContainer();
      if (!container || typeof document === "undefined") {
        resolve(false);
        return;
      }

      const isDanger = type === "danger";
      const iconName = icon || (isDanger ? "delete" : "help_outline");
      const confirmBtnClass = isDanger
        ? "bg-rose-600 hover:bg-rose-700 text-white shadow-rose-600/20"
        : "bg-primary hover:bg-primary-container text-on-primary shadow-primary/20";
      const iconBgClass = isDanger
        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
        : "bg-primary/15 text-primary dark:bg-primary/30 dark:text-primary-fixed";

      const formattedMsg = String(message)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");

      const wrapper = document.createElement("div");
      wrapper.className = "modal-backdrop-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto transition-opacity duration-200 opacity-0";
      wrapper.innerHTML = `
        <div class="modal-card bg-surface-container-lowest text-on-surface rounded-3xl shadow-2xl border border-surface-container-high max-w-md w-full p-6 flex flex-col gap-4 transform transition-all duration-200 scale-95" role="dialog" aria-modal="true" aria-labelledby="uiModalTitle">
          <div class="flex items-start gap-3.5">
            <div class="w-10 h-10 rounded-2xl ${iconBgClass} flex items-center justify-center flex-shrink-0 mt-0.5">
              <span class="material-symbols-outlined text-[22px]">${iconName}</span>
            </div>
            <div class="flex-1 min-w-0">
              <h3 id="uiModalTitle" class="font-headline-sm text-base font-bold text-on-surface leading-snug">${title}</h3>
              <div class="font-body-md text-xs text-on-surface-variant mt-1.5 leading-relaxed break-words">${formattedMsg}</div>
            </div>
          </div>
          <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-variant/20 mt-1">
            <button class="modal-cancel-btn px-4 py-2.5 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition-colors">
              ${cancelText}
            </button>
            <button class="modal-confirm-btn px-5 py-2.5 rounded-2xl font-bold text-xs shadow-md transition-colors ${confirmBtnClass} flex items-center gap-1.5">
              <span>${confirmText}</span>
            </button>
          </div>
        </div>
      `;

      container.appendChild(wrapper);

      setTimeout(() => {
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-0");
          wrapper.classList.add("opacity-100");
          const card = wrapper.querySelector ? wrapper.querySelector(".modal-card") : null;
          if (card && card.classList) {
            card.classList.remove("scale-95");
            card.classList.add("scale-100");
          }
        }
      }, 15);

      const cleanup = (result) => {
        if (typeof document !== "undefined" && document.removeEventListener) {
          document.removeEventListener("keydown", onKeyDown);
        }
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-100");
          wrapper.classList.add("opacity-0");
        }
        setTimeout(() => {
          if (wrapper.remove) wrapper.remove();
          else if (wrapper.parentNode && wrapper.parentNode.removeChild) wrapper.parentNode.removeChild(wrapper);
          resolve(result);
        }, 180);
      };

      const onKeyDown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cleanup(false);
        } else if (e.key === "Enter") {
          e.preventDefault();
          cleanup(true);
        }
      };

      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("keydown", onKeyDown);
      }

      wrapper.addEventListener("click", (e) => {
        if (e.target === wrapper) cleanup(false);
      });

      const cancelBtn = wrapper.querySelector ? wrapper.querySelector(".modal-cancel-btn") : null;
      if (cancelBtn) cancelBtn.addEventListener("click", () => cleanup(false));

      const confirmBtn = wrapper.querySelector ? wrapper.querySelector(".modal-confirm-btn") : null;
      if (confirmBtn) {
        confirmBtn.addEventListener("click", () => cleanup(true));
        if (confirmBtn.focus) setTimeout(() => confirmBtn.focus(), 50);
      }
    });
  },

  /**
   * Prompt Dialog (Single input)
   * @param {Object} options
   * @returns {Promise<string|null>}
   */
  prompt({
    title = "Ingresar Dato",
    message = "",
    defaultValue = "",
    placeholder = "",
    inputType = "text",
    confirmText = "Guardar",
    cancelText = "Cancelar"
  } = {}) {
    return new Promise((resolve) => {
      const container = this._getContainer();
      if (!container || typeof document === "undefined") {
        resolve(null);
        return;
      }

      const formattedMsg = String(message)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");

      const wrapper = document.createElement("div");
      wrapper.className = "modal-backdrop-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto transition-opacity duration-200 opacity-0";
      wrapper.innerHTML = `
        <div class="modal-card bg-surface-container-lowest text-on-surface rounded-3xl shadow-2xl border border-surface-container-high max-w-md w-full p-6 flex flex-col gap-4 transform transition-all duration-200 scale-95" role="dialog" aria-modal="true">
          <div class="flex items-start gap-3">
            <div class="w-9 h-9 rounded-2xl bg-primary/15 text-primary flex items-center justify-center flex-shrink-0 mt-0.5">
              <span class="material-symbols-outlined text-[20px]">edit</span>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-headline-sm text-base font-bold text-on-surface leading-snug">${title}</h3>
              ${formattedMsg ? `<div class="font-body-md text-xs text-on-surface-variant mt-1 leading-relaxed">${formattedMsg}</div>` : ""}
            </div>
          </div>
          <div>
            <input type="${inputType}" class="modal-prompt-input w-full px-4 py-2.5 rounded-2xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all" value="${String(defaultValue).replace(/"/g, '&quot;')}" placeholder="${placeholder}" />
          </div>
          <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-variant/20 mt-1">
            <button class="modal-cancel-btn px-4 py-2.5 rounded-2xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition-colors">
              ${cancelText}
            </button>
            <button class="modal-confirm-btn px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-container text-on-primary font-bold text-xs shadow-md shadow-primary/20 transition-colors">
              ${confirmText}
            </button>
          </div>
        </div>
      `;

      container.appendChild(wrapper);

      const input = wrapper.querySelector ? wrapper.querySelector(".modal-prompt-input") : null;

      setTimeout(() => {
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-0");
          wrapper.classList.add("opacity-100");
          const card = wrapper.querySelector ? wrapper.querySelector(".modal-card") : null;
          if (card && card.classList) {
            card.classList.remove("scale-95");
            card.classList.add("scale-100");
          }
        }
        if (input && input.focus) {
          input.focus();
          if (input.select) input.select();
        }
      }, 15);

      const cleanup = (value) => {
        if (typeof document !== "undefined" && document.removeEventListener) {
          document.removeEventListener("keydown", onKeyDown);
        }
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-100");
          wrapper.classList.add("opacity-0");
        }
        setTimeout(() => {
          if (wrapper.remove) wrapper.remove();
          else if (wrapper.parentNode && wrapper.parentNode.removeChild) wrapper.parentNode.removeChild(wrapper);
          resolve(value);
        }, 180);
      };

      const onKeyDown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cleanup(null);
        } else if (e.key === "Enter") {
          e.preventDefault();
          cleanup(input ? input.value : defaultValue);
        }
      };

      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("keydown", onKeyDown);
      }

      wrapper.addEventListener("click", (e) => {
        if (e.target === wrapper) cleanup(null);
      });

      const cancelBtn = wrapper.querySelector ? wrapper.querySelector(".modal-cancel-btn") : null;
      if (cancelBtn) cancelBtn.addEventListener("click", () => cleanup(null));

      const confirmBtn = wrapper.querySelector ? wrapper.querySelector(".modal-confirm-btn") : null;
      if (confirmBtn) {
        confirmBtn.addEventListener("click", () => {
          cleanup(input ? input.value : defaultValue);
        });
      }
    });
  },

  /**
   * Alert Dialog (Mandatory acknowledgement)
   * @param {Object} options
   * @returns {Promise<void>}
   */
  alert({
    title = "Aviso",
    message = "",
    type = "info",
    confirmText = "Entendido"
  } = {}) {
    return new Promise((resolve) => {
      const container = this._getContainer();
      if (!container || typeof document === "undefined") {
        resolve();
        return;
      }

      const styles = {
        info: { icon: "info", iconBg: "bg-primary/15 text-primary" },
        warning: { icon: "warning", iconBg: "bg-amber-100 text-amber-700" },
        error: { icon: "error", iconBg: "bg-rose-100 text-rose-700" },
        success: { icon: "check_circle", iconBg: "bg-emerald-100 text-emerald-700" }
      };
      const style = styles[type] || styles.info;

      const formattedMsg = String(message)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br/>");

      const wrapper = document.createElement("div");
      wrapper.className = "modal-backdrop-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto transition-opacity duration-200 opacity-0";
      wrapper.innerHTML = `
        <div class="modal-card bg-surface-container-lowest text-on-surface rounded-3xl shadow-2xl border border-surface-container-high max-w-md w-full p-6 flex flex-col gap-4 transform transition-all duration-200 scale-95" role="dialog" aria-modal="true">
          <div class="flex items-start gap-3.5">
            <div class="w-10 h-10 rounded-2xl ${style.iconBg} flex items-center justify-center flex-shrink-0 mt-0.5">
              <span class="material-symbols-outlined text-[22px]">${style.icon}</span>
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-headline-sm text-base font-bold text-on-surface leading-snug">${title}</h3>
              <div class="font-body-md text-xs text-on-surface-variant mt-1.5 leading-relaxed break-words">${formattedMsg}</div>
            </div>
          </div>
          <div class="flex items-center justify-end pt-2 border-t border-surface-variant/20 mt-1">
            <button class="modal-confirm-btn w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-primary hover:bg-primary-container text-on-primary font-bold text-xs shadow-md shadow-primary/20 transition-colors">
              ${confirmText}
            </button>
          </div>
        </div>
      `;

      container.appendChild(wrapper);

      setTimeout(() => {
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-0");
          wrapper.classList.add("opacity-100");
          const card = wrapper.querySelector ? wrapper.querySelector(".modal-card") : null;
          if (card && card.classList) {
            card.classList.remove("scale-95");
            card.classList.add("scale-100");
          }
        }
      }, 15);

      const cleanup = () => {
        if (typeof document !== "undefined" && document.removeEventListener) {
          document.removeEventListener("keydown", onKeyDown);
        }
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-100");
          wrapper.classList.add("opacity-0");
        }
        setTimeout(() => {
          if (wrapper.remove) wrapper.remove();
          else if (wrapper.parentNode && wrapper.parentNode.removeChild) wrapper.parentNode.removeChild(wrapper);
          resolve();
        }, 180);
      };

      const onKeyDown = (e) => {
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          cleanup();
        }
      };

      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("keydown", onKeyDown);
      }

      wrapper.addEventListener("click", (e) => {
        if (e.target === wrapper) cleanup();
      });

      const confirmBtn = wrapper.querySelector ? wrapper.querySelector(".modal-confirm-btn") : null;
      if (confirmBtn) {
        confirmBtn.addEventListener("click", cleanup);
        if (confirmBtn.focus) setTimeout(() => confirmBtn.focus(), 50);
      }
    });
  },

  /**
   * Unified Recipe Ingredient Modal Form
   * Replaces 4 consecutive prompt() calls with a single elegant form
   * @returns {Promise<{name: string, quantity: number, unit: string, unitCost: number}|null>}
   */
  showAddIngredientModal() {
    return new Promise((resolve) => {
      const container = this._getContainer();
      if (!container || typeof document === "undefined") {
        resolve(null);
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.className = "modal-backdrop-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto transition-opacity duration-200 opacity-0";
      wrapper.innerHTML = `
        <div class="modal-card bg-surface-container-lowest text-on-surface rounded-3xl shadow-2xl border border-surface-container-high max-w-md w-full p-6 flex flex-col gap-4 transform transition-all duration-200 scale-95" role="dialog" aria-modal="true">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">grocery</span>
              </div>
              <div>
                <h3 class="font-headline-sm text-base font-bold text-on-surface">Agregar Ingrediente</h3>
                <p class="text-xs text-on-surface-variant">Insumo para el escandallo de la receta</p>
              </div>
            </div>
            <button class="modal-close-btn text-on-surface-variant hover:text-on-surface p-1 rounded-xl">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form class="modal-ing-form flex flex-col gap-3.5">
            <div>
              <label class="block text-xs font-bold text-on-surface mb-1">Nombre del Ingrediente *</label>
              <input type="text" id="mIngName" required placeholder="Ej: Azúcar Moreno, Harina 000" class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" value="Azúcar Moreno" />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-on-surface mb-1">Cantidad *</label>
                <input type="number" id="mIngQty" required step="any" min="0.001" placeholder="0.25" value="0.25" class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
              <div>
                <label class="block text-xs font-bold text-on-surface mb-1">Unidad de Medida *</label>
                <select id="mIngUnit" class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary">
                  <option value="kg" selected>kg (Kilogramos)</option>
                  <option value="g">g (Gramos)</option>
                  <option value="L">L (Litros)</option>
                  <option value="ml">ml (Mililitros)</option>
                  <option value="unid">unid (Unidades)</option>
                  <option value="kit">kit (Empaque/Kit)</option>
                </select>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-on-surface mb-1">Costo Unitario ($ por unidad) *</label>
              <div class="relative">
                <span class="absolute left-3.5 top-2.5 text-xs text-on-surface-variant font-bold">$</span>
                <input type="number" id="mIngCost" required step="any" min="0" placeholder="2.50" value="2.50" class="w-full pl-7 pr-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-variant/20 mt-1">
              <button type="button" class="modal-cancel-btn px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition-colors">
                Cancelar
              </button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-bold text-xs shadow-md shadow-primary/20 transition-colors flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">add</span>
                <span>Añadir Ingrediente</span>
              </button>
            </div>
          </form>
        </div>
      `;

      container.appendChild(wrapper);

      setTimeout(() => {
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-0");
          wrapper.classList.add("opacity-100");
          const card = wrapper.querySelector ? wrapper.querySelector(".modal-card") : null;
          if (card && card.classList) {
            card.classList.remove("scale-95");
            card.classList.add("scale-100");
          }
        }
        const nameInput = wrapper.querySelector ? wrapper.querySelector("#mIngName") : null;
        if (nameInput && nameInput.focus) {
          nameInput.focus();
          if (nameInput.select) nameInput.select();
        }
      }, 15);

      const cleanup = (val) => {
        if (typeof document !== "undefined" && document.removeEventListener) {
          document.removeEventListener("keydown", onKeyDown);
        }
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-100");
          wrapper.classList.add("opacity-0");
        }
        setTimeout(() => {
          if (wrapper.remove) wrapper.remove();
          else if (wrapper.parentNode && wrapper.parentNode.removeChild) wrapper.parentNode.removeChild(wrapper);
          resolve(val);
        }, 180);
      };

      const onKeyDown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cleanup(null);
        }
      };

      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("keydown", onKeyDown);
      }

      wrapper.addEventListener("click", (e) => {
        if (e.target === wrapper) cleanup(null);
      });

      const cancelBtn = wrapper.querySelector ? wrapper.querySelector(".modal-cancel-btn") : null;
      if (cancelBtn) cancelBtn.addEventListener("click", () => cleanup(null));

      const closeBtn = wrapper.querySelector ? wrapper.querySelector(".modal-close-btn") : null;
      if (closeBtn) closeBtn.addEventListener("click", () => cleanup(null));

      const form = wrapper.querySelector ? wrapper.querySelector(".modal-ing-form") : null;
      if (form) {
        form.addEventListener("submit", (e) => {
          if (e.preventDefault) e.preventDefault();
          const name = wrapper.querySelector("#mIngName")?.value?.trim();
          const qty = parseFloat(wrapper.querySelector("#mIngQty")?.value) || 0.1;
          const unit = wrapper.querySelector("#mIngUnit")?.value?.trim() || "kg";
          const cost = parseFloat(wrapper.querySelector("#mIngCost")?.value) || 0;

          if (!name) return;
          cleanup({
            name,
            quantity: qty,
            unit,
            unitCost: cost
          });
        });
      }
    });
  },

  /**
   * Unified Inventory Item Modal Form
   * Replaces 6 consecutive prompt() calls with a single elegant card
   * @returns {Promise<{name: string, category: string, stock: number, unit: string, costPerUnit: number, supplier: string}|null>}
   */
  showAddSupplyModal() {
    return new Promise((resolve) => {
      const container = this._getContainer();
      if (!container || typeof document === "undefined") {
        resolve(null);
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.className = "modal-backdrop-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto transition-opacity duration-200 opacity-0";
      wrapper.innerHTML = `
        <div class="modal-card bg-surface-container-lowest text-on-surface rounded-3xl shadow-2xl border border-surface-container-high max-w-lg w-full p-6 flex flex-col gap-4 transform transition-all duration-200 scale-95" role="dialog" aria-modal="true">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">inventory_2</span>
              </div>
              <div>
                <h3 class="font-headline-sm text-base font-bold text-on-surface">Registrar Nuevo Insumo</h3>
                <p class="text-xs text-on-surface-variant">Ingreso a la despensa de pastelería</p>
              </div>
            </div>
            <button class="modal-close-btn text-on-surface-variant hover:text-on-surface p-1 rounded-xl">
              <span class="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          <form class="modal-supply-form flex flex-col gap-3.5">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-on-surface mb-1">Nombre del Insumo *</label>
                <input type="text" id="mSupplyName" required placeholder="Ej: Chocolate Blanco 32%" value="Chocolate Blanco 32%" class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
              <div>
                <label class="block text-xs font-bold text-on-surface mb-1">Categoría *</label>
                <select id="mSupplyCategory" class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary">
                  <option value="Harinas" selected>Harinas</option>
                  <option value="Lácteos">Lácteos</option>
                  <option value="Frutas">Frutas</option>
                  <option value="Packaging">Packaging</option>
                  <option value="Chocolates">Chocolates</option>
                  <option value="Varios">Varios</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-bold text-on-surface mb-1">Stock Inicial *</label>
                <input type="number" id="mSupplyStock" required step="any" min="0" placeholder="5.0" value="5.0" class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
              <div>
                <label class="block text-xs font-bold text-on-surface mb-1">Unidad *</label>
                <select id="mSupplyUnit" class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary">
                  <option value="kg" selected>kg (Kilos)</option>
                  <option value="L">L (Litros)</option>
                  <option value="unid">unid (Unidades)</option>
                  <option value="g">g (Gramos)</option>
                  <option value="kit">kit (Pack)</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-on-surface mb-1">Costo Unitario ($) *</label>
                <div class="relative">
                  <span class="absolute left-3 top-2 text-xs text-on-surface-variant font-bold">$</span>
                  <input type="number" id="mSupplyCost" required step="any" min="0" placeholder="12.50" value="12.50" class="w-full pl-6 pr-3 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
                </div>
              </div>
            </div>

            <div>
              <label class="block text-xs font-bold text-on-surface mb-1">Proveedor / Distribuidora</label>
              <input type="text" id="mSupplySupplier" placeholder="Distribuidora Dulce" value="Distribuidora Dulce" class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-variant/20 mt-1">
              <button type="button" class="modal-cancel-btn px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition-colors">
                Cancelar
              </button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-bold text-xs shadow-md shadow-primary/20 transition-colors flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">save</span>
                <span>Guardar Insumo</span>
              </button>
            </div>
          </form>
        </div>
      `;

      container.appendChild(wrapper);

      setTimeout(() => {
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-0");
          wrapper.classList.add("opacity-100");
          const card = wrapper.querySelector ? wrapper.querySelector(".modal-card") : null;
          if (card && card.classList) {
            card.classList.remove("scale-95");
            card.classList.add("scale-100");
          }
        }
        const nameInput = wrapper.querySelector ? wrapper.querySelector("#mSupplyName") : null;
        if (nameInput && nameInput.focus) {
          nameInput.focus();
          if (nameInput.select) nameInput.select();
        }
      }, 15);

      const cleanup = (val) => {
        if (typeof document !== "undefined" && document.removeEventListener) {
          document.removeEventListener("keydown", onKeyDown);
        }
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-100");
          wrapper.classList.add("opacity-0");
        }
        setTimeout(() => {
          if (wrapper.remove) wrapper.remove();
          else if (wrapper.parentNode && wrapper.parentNode.removeChild) wrapper.parentNode.removeChild(wrapper);
          resolve(val);
        }, 180);
      };

      const onKeyDown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cleanup(null);
        }
      };

      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("keydown", onKeyDown);
      }

      wrapper.addEventListener("click", (e) => {
        if (e.target === wrapper) cleanup(null);
      });

      const cancelBtn = wrapper.querySelector ? wrapper.querySelector(".modal-cancel-btn") : null;
      if (cancelBtn) cancelBtn.addEventListener("click", () => cleanup(null));

      const closeBtn = wrapper.querySelector ? wrapper.querySelector(".modal-close-btn") : null;
      if (closeBtn) closeBtn.addEventListener("click", () => cleanup(null));

      const form = wrapper.querySelector ? wrapper.querySelector(".modal-supply-form") : null;
      if (form) {
        form.addEventListener("submit", (e) => {
          if (e.preventDefault) e.preventDefault();
          const name = wrapper.querySelector("#mSupplyName")?.value?.trim();
          const category = wrapper.querySelector("#mSupplyCategory")?.value?.trim() || "Harinas";
          const stock = parseFloat(wrapper.querySelector("#mSupplyStock")?.value) || 1.0;
          const unit = wrapper.querySelector("#mSupplyUnit")?.value?.trim() || "kg";
          const costPerUnit = parseFloat(wrapper.querySelector("#mSupplyCost")?.value) || 5.0;
          const supplier = wrapper.querySelector("#mSupplySupplier")?.value?.trim() || "Proveedor Directo";

          if (!name) return;
          cleanup({
            name,
            category,
            stock,
            unit,
            costPerUnit,
            supplier
          });
        });
      }
    });
  },

  /**
   * Fast Inventory Adjustment Modal
   * @param {Object} item
   * @returns {Promise<{stock: number, costPerUnit: number}|null>}
   */
  showEditSupplyModal(item) {
    return new Promise((resolve) => {
      const container = this._getContainer();
      if (!container || typeof document === "undefined" || !item) {
        resolve(null);
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.className = "modal-backdrop-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto transition-opacity duration-200 opacity-0";
      wrapper.innerHTML = `
        <div class="modal-card bg-surface-container-lowest text-on-surface rounded-3xl shadow-2xl border border-surface-container-high max-w-sm w-full p-6 flex flex-col gap-4 transform transition-all duration-200 scale-95" role="dialog" aria-modal="true">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">tune</span>
              </div>
              <div class="min-w-0">
                <h3 class="font-headline-sm text-sm font-bold text-on-surface truncate">${item.name}</h3>
                <p class="text-xs text-on-surface-variant">Ajuste rápido de inventario</p>
              </div>
            </div>
            <button class="modal-close-btn text-on-surface-variant hover:text-on-surface p-1 rounded-xl">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <form class="modal-edit-supply-form flex flex-col gap-3.5">
            <div>
              <label class="block text-xs font-bold text-on-surface mb-1">Stock Actual (${item.unit}) *</label>
              <input type="number" id="mEditSupplyStock" required step="any" min="0" value="${item.stock}" class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>

            <div>
              <label class="block text-xs font-bold text-on-surface mb-1">Costo por ${item.unit} ($) *</label>
              <div class="relative">
                <span class="absolute left-3.5 top-2 text-xs text-on-surface-variant font-bold">$</span>
                <input type="number" id="mEditSupplyCost" required step="any" min="0" value="${item.costPerUnit}" class="w-full pl-7 pr-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
              </div>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-variant/20 mt-1">
              <button type="button" class="modal-cancel-btn px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition-colors">
                Cancelar
              </button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-bold text-xs shadow-md shadow-primary/20 transition-colors">
                Actualizar
              </button>
            </div>
          </form>
        </div>
      `;

      container.appendChild(wrapper);

      setTimeout(() => {
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-0");
          wrapper.classList.add("opacity-100");
          const card = wrapper.querySelector ? wrapper.querySelector(".modal-card") : null;
          if (card && card.classList) {
            card.classList.remove("scale-95");
            card.classList.add("scale-100");
          }
        }
        const stockInput = wrapper.querySelector ? wrapper.querySelector("#mEditSupplyStock") : null;
        if (stockInput && stockInput.focus) {
          stockInput.focus();
          if (stockInput.select) stockInput.select();
        }
      }, 15);

      const cleanup = (val) => {
        if (typeof document !== "undefined" && document.removeEventListener) {
          document.removeEventListener("keydown", onKeyDown);
        }
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-100");
          wrapper.classList.add("opacity-0");
        }
        setTimeout(() => {
          if (wrapper.remove) wrapper.remove();
          else if (wrapper.parentNode && wrapper.parentNode.removeChild) wrapper.parentNode.removeChild(wrapper);
          resolve(val);
        }, 180);
      };

      const onKeyDown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cleanup(null);
        }
      };

      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("keydown", onKeyDown);
      }

      wrapper.addEventListener("click", (e) => {
        if (e.target === wrapper) cleanup(null);
      });

      const cancelBtn = wrapper.querySelector ? wrapper.querySelector(".modal-cancel-btn") : null;
      if (cancelBtn) cancelBtn.addEventListener("click", () => cleanup(null));

      const closeBtn = wrapper.querySelector ? wrapper.querySelector(".modal-close-btn") : null;
      if (closeBtn) closeBtn.addEventListener("click", () => cleanup(null));

      const form = wrapper.querySelector ? wrapper.querySelector(".modal-edit-supply-form") : null;
      if (form) {
        form.addEventListener("submit", (e) => {
          if (e.preventDefault) e.preventDefault();
          const stock = parseFloat(wrapper.querySelector("#mEditSupplyStock")?.value);
          const costPerUnit = parseFloat(wrapper.querySelector("#mEditSupplyCost")?.value);

          cleanup({
            stock: isNaN(stock) ? item.stock : stock,
            costPerUnit: isNaN(costPerUnit) ? item.costPerUnit : costPerUnit
          });
        });
      }
    });
  },

  /**
   * New Kitchen Baking Timer Modal
   * Replaces 2 consecutive prompt() calls with a single dialog
   * @returns {Promise<{label: string, minutes: number}|null>}
   */
  showNewTimerModal() {
    return new Promise((resolve) => {
      const container = this._getContainer();
      if (!container || typeof document === "undefined") {
        resolve(null);
        return;
      }

      const wrapper = document.createElement("div");
      wrapper.className = "modal-backdrop-overlay fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pointer-events-auto transition-opacity duration-200 opacity-0";
      wrapper.innerHTML = `
        <div class="modal-card bg-surface-container-lowest text-on-surface rounded-3xl shadow-2xl border border-surface-container-high max-w-sm w-full p-6 flex flex-col gap-4 transform transition-all duration-200 scale-95" role="dialog" aria-modal="true">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="w-9 h-9 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
                <span class="material-symbols-outlined text-[20px]">timer</span>
              </div>
              <div>
                <h3 class="font-headline-sm text-base font-bold text-on-surface">Nuevo Temporizador</h3>
                <p class="text-xs text-on-surface-variant">Control de cocción y horneado</p>
              </div>
            </div>
            <button class="modal-close-btn text-on-surface-variant hover:text-on-surface p-1 rounded-xl">
              <span class="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          <form class="modal-timer-form flex flex-col gap-3.5">
            <div>
              <label class="block text-xs font-bold text-on-surface mb-1">Nombre de la Preparación *</label>
              <input type="text" id="mTimerLabel" required placeholder="Ej: Torta en Horno, Macarons" value="Torta en Horno" class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>

            <div>
              <label class="block text-xs font-bold text-on-surface mb-1">Minutos en Horno *</label>
              <input type="number" id="mTimerMins" required step="any" min="1" max="600" value="35" class="w-full px-3.5 py-2 rounded-xl bg-surface-container-low border border-outline-variant/40 text-on-surface text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary" />
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-variant/20 mt-1">
              <button type="button" class="modal-cancel-btn px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition-colors">
                Cancelar
              </button>
              <button type="submit" class="px-5 py-2 rounded-xl bg-primary hover:bg-primary-container text-on-primary font-bold text-xs shadow-md shadow-primary/20 transition-colors flex items-center gap-1.5">
                <span class="material-symbols-outlined text-[16px]">play_arrow</span>
                <span>Iniciar Temporizador</span>
              </button>
            </div>
          </form>
        </div>
      `;

      container.appendChild(wrapper);

      setTimeout(() => {
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-0");
          wrapper.classList.add("opacity-100");
          const card = wrapper.querySelector ? wrapper.querySelector(".modal-card") : null;
          if (card && card.classList) {
            card.classList.remove("scale-95");
            card.classList.add("scale-100");
          }
        }
        const labelInput = wrapper.querySelector ? wrapper.querySelector("#mTimerLabel") : null;
        if (labelInput && labelInput.focus) {
          labelInput.focus();
          if (labelInput.select) labelInput.select();
        }
      }, 15);

      const cleanup = (val) => {
        if (typeof document !== "undefined" && document.removeEventListener) {
          document.removeEventListener("keydown", onKeyDown);
        }
        if (wrapper.classList) {
          wrapper.classList.remove("opacity-100");
          wrapper.classList.add("opacity-0");
        }
        setTimeout(() => {
          if (wrapper.remove) wrapper.remove();
          else if (wrapper.parentNode && wrapper.parentNode.removeChild) wrapper.parentNode.removeChild(wrapper);
          resolve(val);
        }, 180);
      };

      const onKeyDown = (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          cleanup(null);
        }
      };

      if (typeof document !== "undefined" && document.addEventListener) {
        document.addEventListener("keydown", onKeyDown);
      }

      wrapper.addEventListener("click", (e) => {
        if (e.target === wrapper) cleanup(null);
      });

      const cancelBtn = wrapper.querySelector ? wrapper.querySelector(".modal-cancel-btn") : null;
      if (cancelBtn) cancelBtn.addEventListener("click", () => cleanup(null));

      const closeBtn = wrapper.querySelector ? wrapper.querySelector(".modal-close-btn") : null;
      if (closeBtn) closeBtn.addEventListener("click", () => cleanup(null));

      const form = wrapper.querySelector ? wrapper.querySelector(".modal-timer-form") : null;
      if (form) {
        form.addEventListener("submit", (e) => {
          if (e.preventDefault) e.preventDefault();
          const label = wrapper.querySelector("#mTimerLabel")?.value?.trim() || "Temporizador";
          const mins = parseFloat(wrapper.querySelector("#mTimerMins")?.value) || 15;
          cleanup({
            label,
            minutes: mins
          });
        });
      }
    });
  }
};

/**
 * Global Interception and Polyfill Installation
 * Intercepts window.alert, window.confirm, and window.prompt to prevent native OS / WebView "file://" dialogs.
 */
export function installDialogPolyfills(force = false) {
  if (typeof window === "undefined") return;

  if (window._dialogPolyfillsInstalled && !force) return;

  // Preserve native references if needed
  if (!window._nativeAlert && window.alert) window._nativeAlert = window.alert;
  if (!window._nativeConfirm && window.confirm) window._nativeConfirm = window.confirm;
  if (!window._nativePrompt && window.prompt) window._nativePrompt = window.prompt;

  // Polyfill alert
  const polyfillAlert = function(message) {
    const msg = String(message ?? "");
    window._lastAlert = msg;
    uiToast.info(msg);
  };

  // Polyfill confirm
  const polyfillConfirm = function(message) {
    console.warn("[SweetSmile] Sync window.confirm intercepted (prefer uiModal.confirm):", message);
    if (typeof window._lastConfirm !== "undefined") {
      window._lastConfirm = String(message);
    }
    return false;
  };

  // Polyfill prompt
  const polyfillPrompt = function(message, defaultValue = "") {
    console.warn("[SweetSmile] Sync window.prompt intercepted (prefer uiModal.prompt):", message);
    return defaultValue || null;
  };

  window._fallbackPrompt = polyfillPrompt;
  window.alert = polyfillAlert;
  window.confirm = polyfillConfirm;
  window.prompt = polyfillPrompt;

  window._dialogPolyfillsInstalled = true;
}

// Auto-expose on window in browser / WebView environments
if (typeof window !== "undefined") {
  window.uiToast = uiToast;
  window.uiModal = uiModal;
  // Automatically install polyfills unless explicitly running in a headless test environment without DOM
  if (typeof document !== "undefined" && !window._isHeadlessTestRunner) {
    installDialogPolyfills();
  }
}
