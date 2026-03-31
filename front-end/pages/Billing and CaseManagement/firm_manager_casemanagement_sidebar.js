document.addEventListener("DOMContentLoaded", () => {
  const e = document.querySelector(".sidebar"),
    t = document.getElementById("sidebarToggle"),
    s = 960,
    d = "true" === localStorage.getItem("lexflow_sidebar_collapsed");
  ((window.innerWidth <= s || d) && e.classList.add("collapsed"),
    t &&
      t.addEventListener("click", () => {
        if ((e.classList.toggle("collapsed"), window.innerWidth > s)) {
          const t = e.classList.contains("collapsed");
          localStorage.setItem("lexflow_sidebar_collapsed", t);
        }
        window.dispatchEvent(new Event("resize"));
      }));
  let a = window.innerWidth;
  window.addEventListener("resize", () => {
    const t = window.innerWidth;
    if (t <= s && a > s) e.classList.add("collapsed");
    else if (t > s && a <= s) {
      "true" === localStorage.getItem("lexflow_sidebar_collapsed")
        ? e.classList.add("collapsed")
        : e.classList.remove("collapsed");
    }
    a = t;
  });
});
