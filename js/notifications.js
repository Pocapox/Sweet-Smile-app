// js/notifications.js - Web Push Notifications & Kitchen Baking Timers
import { store } from './store.js';

export class NotificationService {
  constructor() {
    this.activeTimers = [];
    this.hasPermission = ("Notification" in window) && Notification.permission === "granted";
    this.audioCtx = null;
  }

  async requestPermission() {
    if (!("Notification" in window)) {
      console.warn("Notifications not supported in this browser.");
      return false;
    }
    const permission = await Notification.requestPermission();
    this.hasPermission = permission === "granted";
    return this.hasPermission;
  }

  playKitchenChime() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      const ctx = this.audioCtx;
      if (ctx.state === "suspended") ctx.resume();

      // Pleasing dual-tone culinary chime
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = "sine";
      osc2.type = "triangle";
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
      osc2.frequency.setValueAtTime(440, ctx.currentTime);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 1.2);
      osc2.stop(ctx.currentTime + 1.2);
    } catch (e) {
      console.log("Audio feedback not permitted or error:", e);
    }
  }

  sendPush(title, options = {}) {
    this.playKitchenChime();
    
    // In-app visual toast
    this.showToast(title, options.body || "");

    // System push notification
    if (this.hasPermission) {
      try {
        new Notification(title, {
          icon: "https://lh3.googleusercontent.com/aida-public/AB6AXuCUGUg7P1C8LywkVtJqLkY4D53zo4tyqUmnYtj_JEKHBXSQekjkhTphOh6O5krRL-kggUEmVtQpV5VAcJo-uhyGaHVaSkGFQmO88hOeySu-Lh67MNxdFHCT75hrbeY62OdASz7Ur-oMQGjNBfLa_BdtDuLJX48i78-dVjXW6Ou3GZ538o51lALo-LkBQ3e_oHxldp3tfiQgF8qu4XHz9NXMmvxLHqgoZcwI36eenA",
          badge: "https://lh3.googleusercontent.com/aida-public/AB6AXuCUGUg7P1C8LywkVtJqLkY4D53zo4tyqUmnYtj_JEKHBXSQekjkhTphOh6O5krRL-kggUEmVtQpV5VAcJo-uhyGaHVaSkGFQmO88hOeySu-Lh67MNxdFHCT75hrbeY62OdASz7Ur-oMQGjNBfLa_BdtDuLJX48i78-dVjXW6Ou3GZ538o51lALo-LkBQ3e_oHxldp3tfiQgF8qu4XHz9NXMmvxLHqgoZcwI36eenA",
          vibrate: [200, 100, 200],
          ...options
        });
      } catch (err) {
        console.warn("Could not fire system notification", err);
      }
    }
  }

  showToast(title, subtitle = "") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "pointer-events-auto bg-surface-container-lowest text-on-surface p-3.5 rounded-xl shadow-xl border border-primary/20 flex items-start gap-3 transition-all duration-300 transform translate-y-[-10px] opacity-0";
    toast.innerHTML = `
      <div class="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0 mt-0.5">
        <span class="material-symbols-outlined text-[18px]">notifications_active</span>
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="font-headline-sm text-[14px] text-on-surface font-bold leading-tight">${title}</h4>
        ${subtitle ? `<p class="font-body-sm text-[12px] text-on-surface-variant mt-0.5 leading-snug">${subtitle}</p>` : ""}
      </div>
      <button class="text-on-surface-variant hover:text-on-surface" onclick="this.parentElement.remove()">
        <span class="material-symbols-outlined text-[16px]">close</span>
      </button>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.remove("translate-y-[-10px]", "opacity-0");
    }, 10);

    setTimeout(() => {
      toast.classList.add("opacity-0", "translate-y-[-10px]");
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  // --- KITCHEN BAKING TIMERS ---
  addBakingTimer(label, minutes) {
    const totalSeconds = Math.max(1, Math.round(minutes * 60));
    const timer = {
      id: "timer-" + Date.now(),
      label,
      totalSeconds,
      remainingSeconds: totalSeconds,
      intervalId: null
    };

    timer.intervalId = setInterval(() => {
      timer.remainingSeconds--;
      store.notify("timer_tick", { timerId: timer.id, remaining: timer.remainingSeconds });

      if (timer.remainingSeconds <= 0) {
        clearInterval(timer.intervalId);
        this.activeTimers = this.activeTimers.filter(t => t.id !== timer.id);
        this.sendPush(`⏰ ¡Tiempo cumplido en el horno!`, {
          body: `El lote "${timer.label}" ya está listo para retirar.`
        });
        store.notify("timer_completed", timer);
      }
    }, 1000);

    this.activeTimers.push(timer);
    this.sendPush("🔥 Temporizador Iniciado", {
      body: `"${label}" configurado para ${minutes} minutos.`
    });
    return timer;
  }

  getActiveTimers() {
    return this.activeTimers;
  }

  cancelTimer(timerId) {
    const timer = this.activeTimers.find(t => t.id === timerId);
    if (timer) {
      clearInterval(timer.intervalId);
      this.activeTimers = this.activeTimers.filter(t => t.id !== timerId);
      store.notify("timer_cancelled", { timerId });
    }
  }

  // --- EXPIRATION AUDIT ---
  checkExpiringInventory() {
    const inventory = store.getInventory();
    const now = new Date();
    const urgentItems = [];

    inventory.forEach(item => {
      if (item.expDate) {
        const exp = new Date(item.expDate);
        const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
        if (diffDays <= 4 && diffDays >= 0) {
          urgentItems.push({ ...item, daysLeft: diffDays });
        }
      }
    });

    if (urgentItems.length > 0) {
      const names = urgentItems.map(i => `${i.name} (${i.daysLeft}d)`).join(", ");
      this.sendPush("⚠️ Alerta de Vencimiento de Insumos", {
        body: `Ingredientes próximos a caducar: ${names}`
      });
    }
    return urgentItems;
  }
}

export const notifications = new NotificationService();
