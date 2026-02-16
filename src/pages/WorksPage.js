/**
 * WorksPage — 開発事例 page skeleton
 * Minimal placeholder, designed for easy content expansion
 */
export function createWorksPage() {
    const container = document.createElement('div');
    container.className = 'page-content';
    container.innerHTML = `
    <h2 class="page-title">開発事例</h2>
    <p class="page-subtitle">
      Explore Our Works
    </p>
    <div class="page-section">
      <p class="page-body">
        没入感のある3D体験で、空間を直感的に把握できる<br>
        次世代のデジタルソリューションを提供します。
      </p>
    </div>
  `;
    return container;
}
