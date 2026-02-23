/**
 * ServicesPage — サービス紹介 page skeleton
 * Minimal placeholder, designed for easy content expansion
 */
export function createServicesPage() {
  const container = document.createElement('div');
  container.className = 'page-content';
  container.innerHTML = `
    <h2 class="page-title">サービス</h2>
    <p class="page-subtitle">
      最新技術を駆使したデジタルソリューション
    </p>
    <div class="page-section">
      <p class="page-body">
        3Dモデリング、VR技術、360°コンテンツ、アプリ開発、IoTなど<br>
        幅広い分野で活用可能なソリューションを提供します。
      </p>
    </div>
  `;
  return container;
}
