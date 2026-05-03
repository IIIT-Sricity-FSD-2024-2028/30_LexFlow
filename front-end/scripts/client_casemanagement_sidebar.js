document.addEventListener("DOMContentLoaded", () => {
  const e = document.querySelector(".sidebar"),
    t = document.getElementById("sidebarToggle"),
    s = 960;
  ((window.innerWidth <= s) && e.classList.add("collapsed"),
    t &&
      t.addEventListener("click", () => {
        e.classList.toggle("collapsed");
        window.dispatchEvent(new Event("resize"));
      }));
  let a = window.innerWidth;
  window.addEventListener("resize", () => {
    const t = window.innerWidth;
    if (t <= s && a > s) e.classList.add("collapsed");
    else if (t > s && a <= s) {
      e.classList.remove("collapsed");
    }
    a = t;
  });
});
