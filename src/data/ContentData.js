/**
 * ContentData — Structured content for each stone/category
 * Used by World 2 to display information in 3D space
 */
export const CONTENT = {
    company: {
        id: 'company',
        title: '会社紹介',
        subtitle: 'About COLAPIS',
        sections: [
            {
                heading: 'Vision',
                body: '従来と異なる解像度を高めたIT技術の導入により\nスムーズな生活の提供を目指すべく活動しております。',
            },
            {
                heading: 'Origin',
                body: '弘前大学医学部医学科で同期として出会った3名が\n「医療」と「技術」の融合で新たな未来を拓く。',
            },
            {
                heading: 'Team',
                body: '峯田 陽（代表取締役）\n成澤 木怜（取締役）\n渋谷 逸斗（エンジニア）',
            },
        ],
    },
    services: {
        id: 'services',
        title: 'サービス',
        subtitle: 'Our Services',
        sections: [
            {
                heading: '3Dモデリング',
                body: '高品質な3Dモデルの制作により\n製品やコンセプトを立体的に表現。',
            },
            {
                heading: 'VR家具配置',
                body: '実寸大の家具を仮想空間に配置し\nインテリアコーディネートを直感的にシミュレーション。',
            },
            {
                heading: '360°3Dコンテンツ',
                body: '没入感のある360度3D体験を提供。\nバーチャルツアー、不動産内覧など。',
            },
        ],
    },
    works: {
        id: 'works',
        title: '開発事例',
        subtitle: 'Explore Our Works',
        sections: [
            {
                heading: '認知症支援デバイス',
                body: '家族の安心と自立を支える\nやさしい情報サポートシステム。',
            },
            {
                heading: '3D内見サービス',
                body: '写真データから3D空間を再現。\n質感や部屋の構造をリアルに体験。',
            },
            {
                heading: '受賞・実績',
                body: 'NIPPON INNOVATION AWARD 採択\nあおもり若手起業家プログラム 優勝',
            },
        ],
    },
};
