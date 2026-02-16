/**
 * CompanyPage — 会社紹介 page skeleton
 * Minimal placeholder, designed for easy content expansion
 */
export function createCompanyPage() {
    const container = document.createElement('div');
    container.className = 'page-content';
    container.innerHTML = `
    <h2 class="page-title">会社紹介</h2>
    <p class="page-subtitle">
      COLAPIS — 3Dテクノロジーで未来を創造する
    </p>
    <div class="page-section">
      <p class="page-body">
        株式会社COLAPISは、弘前大学医学部医学科の同期である3名により設立。<br>
        医療とITの融合で社会課題の解決に取り組む革新的な製品・サービスを提供します。
      </p>
    </div>
  `;
    return container;
}
