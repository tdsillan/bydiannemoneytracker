const Modal = {
  open(title, bodyHtml, onMount) {
    document.getElementById("modalTitle").textContent = title;
    const body = document.getElementById("modalBody");
    body.innerHTML = bodyHtml;
    document.getElementById("modalOverlay").classList.add("open");
    if (onMount) onMount(body);
  },

  close() {
    document.getElementById("modalOverlay").classList.remove("open");
    document.getElementById("modalBody").innerHTML = "";
  },
};

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("modalClose").addEventListener("click", () => Modal.close());
  document.getElementById("modalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "modalOverlay") Modal.close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") Modal.close();
  });
});
