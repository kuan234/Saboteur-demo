const ASSETS = {
    sabotage: {
        src: '/assets/action_sabotage_1772908474814.png',
        assetName: 'action_sabotage_1772908474814.png',
    },
    repair: {
        src: '/assets/action_repair_1772908491143.png',
        assetName: 'action_repair_1772908491143.png',
    },
    map: {
        src: '/assets/action_map_1772908508934.png',
        assetName: 'action_map_1772908508934.png',
    },
    rockfall: {
        src: '/assets/action_rockfall_1772908530135.png',
        assetName: 'action_rockfall_1772908530135.png',
    },
    dirt: {
        src: '/assets/texture_dirt_1772909600159.png',
        assetName: 'texture_dirt_1772909600159.png',
    },
    cross: {
        src: '/assets/%E5%8D%81%E5%AD%97%E8%B7%AF%E5%8F%A3.png',
        assetName: '十字路口.png',
    },
    tee: {
        src: '/assets/%E4%B8%89%E5%8F%89%E8%B7%AF-%E5%8C%97%E4%B8%9C%E8%A5%BF.png',
        assetName: '三叉路-北东西.png',
    },
    teeDeadEnd: {
        src: '/assets/%E4%B8%89%E5%8F%89%E8%B7%AF-%E5%A0%B5%E8%B7%AF-%E5%8C%97%E4%B8%9C%E8%A5%BF%E6%96%B9.png',
        assetName: '三叉路-堵路-北东西方.png',
    },
    straight: {
        src: '/assets/%E7%9B%B4%E8%B7%AF-%E5%8C%97%E6%96%B9.png',
        assetName: '直路-北方.png',
    },
    straightDeadEnd: {
        src: '/assets/%E7%9B%B4%E8%B7%AF-%E5%A0%B5%E8%B7%AF-%E5%8C%97%E6%96%B9.png',
        assetName: '直路-堵路-北方.png',
    },
    crossDeadEnd: {
        src: '/assets/%E5%8D%81%E5%AD%97-%E5%A0%B5%E8%B7%AF.png',
        assetName: '十字-堵路.png',
    },
};

export const PATH_THEME = { border: 'border-green-700', label: '路径牌', labelBg: 'bg-green-800/80' };
export const DEAD_END_THEME = { border: 'border-rose-700', label: '堵路牌', labelBg: 'bg-rose-800/80' };
export const ACTION_THEMES = {
    break: { border: 'border-red-700', label: '行动牌', labelBg: 'bg-red-800/80' },
    repair: { border: 'border-blue-700', label: '行动牌', labelBg: 'bg-blue-800/80' },
    map: { border: 'border-purple-700', label: '行动牌', labelBg: 'bg-purple-800/80' },
    rockfall: { border: 'border-orange-700', label: '行动牌', labelBg: 'bg-orange-800/80' },
};

const TEE_ROTATIONS = {
    '1101': 0,
    '1110': 90,
    '0111': 180,
    '1011': 270,
};

const SINGLE_PATH_ROTATIONS = {
    '0010': 0,
    '0001': 90,
    '1000': 180,
    '0100': 270,
};

const buildArt = ({
    asset,
    rotation = 0,
    showLargeGlyph = false,
    mappingMode = 'direct',
    note = '',
}) => ({
    src: asset.src,
    assetName: asset.assetName,
    rotation,
    showLargeGlyph,
    mappingMode,
    note,
});

export const getDirsKey = (card) => (
    Array.isArray(card?.dirs) && card.dirs.length === 4 ? card.dirs.join('') : ''
);

const countOpenDirs = (dirsKey) => dirsKey.split('').filter((dir) => dir === '1').length;

export const inferCardKind = (card) => {
    const name = String(card?.name || '').toLowerCase();
    const desc = String(card?.description || '').toLowerCase();
    const subType = String(card?.subType || card?.actionType || '').toLowerCase();

    if (card?.type === 'path' && (card?.subType === 'dead-end' || name.includes('堵路'))) return 'dead-end';
    if (card?.type === 'path') return 'path';
    if (subType.includes('sabotage') || subType.includes('break') || name.includes('破坏')) return 'break';
    if (subType.includes('repair') || name.includes('修理') || desc.includes('修理')) return 'repair';
    if (subType.includes('map') || name.includes('地图')) return 'map';
    if (subType.includes('rockfall') || name.includes('落石')) return 'rockfall';
    return 'break';
};

export const getTheme = (cardKind) => {
    if (cardKind === 'path') return PATH_THEME;
    if (cardKind === 'dead-end') return DEAD_END_THEME;
    return ACTION_THEMES[cardKind] || ACTION_THEMES.break;
};

export const getPathArt = (card, cardKind) => {
    const dirsKey = getDirsKey(card);
    const openCount = countOpenDirs(dirsKey);

    if (cardKind === 'dead-end') {
        if (dirsKey === '0000') {
            return buildArt({ asset: ASSETS.crossDeadEnd, note: '全堵死直接使用十字堵路图' });
        }
        if (dirsKey === '1010') {
            return buildArt({ asset: ASSETS.straight, note: '竖直双通堵路牌暂时复用普通直路图' });
        }
        if (dirsKey === '0101') {
            return buildArt({ asset: ASSETS.straight, rotation: 90, mappingMode: 'rotated', note: '水平双通堵路牌暂时复用旋转后的普通直路图' });
        }
        if (openCount === 1) {
            return buildArt({
                asset: ASSETS.straightDeadEnd,
                rotation: SINGLE_PATH_ROTATIONS[dirsKey] ?? 0,
                mappingMode: (SINGLE_PATH_ROTATIONS[dirsKey] ?? 0) === 0 ? 'direct' : 'rotated',
                note: '单出口堵路牌使用直路堵路图并按方向旋转',
            });
        }

        return buildArt({
            asset: ASSETS.teeDeadEnd,
            showLargeGlyph: true,
            mappingMode: 'fallback',
            note: '其余堵路牌先复用三叉堵路图，并叠加大符号辅助识别',
        });
    }

    if (dirsKey === '1111') {
        return buildArt({ asset: ASSETS.cross, note: '普通十字路直接使用十字路口图' });
    }
    if (dirsKey === '1010') {
        return buildArt({ asset: ASSETS.straight, note: '竖直直路直接使用直路图' });
    }
    if (dirsKey === '0101') {
        return buildArt({ asset: ASSETS.straight, rotation: 90, mappingMode: 'rotated', note: '水平直路使用直路图旋转 90 度' });
    }
    if (Object.prototype.hasOwnProperty.call(TEE_ROTATIONS, dirsKey)) {
        return buildArt({
            asset: ASSETS.tee,
            rotation: TEE_ROTATIONS[dirsKey],
            mappingMode: TEE_ROTATIONS[dirsKey] === 0 ? 'direct' : 'rotated',
            note: '三叉路统一复用同一张底图，并按开口方向旋转',
        });
    }

    return buildArt({
        asset: ASSETS.dirt,
        showLargeGlyph: true,
        mappingMode: 'fallback',
        note: '当前没有精确专图，先使用矿洞纹理图并叠加大符号',
    });
};

export const getCardArt = (card) => {
    const cardKind = inferCardKind(card);

    if (cardKind === 'dead-end' || cardKind === 'path') {
        return getPathArt(card, cardKind);
    }
    if (cardKind === 'break') return buildArt({ asset: ASSETS.sabotage, note: '破坏牌使用 sabotage 图片' });
    if (cardKind === 'repair') return buildArt({ asset: ASSETS.repair, note: '修理牌使用 repair 图片' });
    if (cardKind === 'map') return buildArt({ asset: ASSETS.map, note: '地图牌使用 map 图片' });
    if (cardKind === 'rockfall') return buildArt({ asset: ASSETS.rockfall, note: '落石牌使用 rockfall 图片' });

    return buildArt({ asset: ASSETS.dirt, mappingMode: 'fallback', note: '未知牌型先使用矿洞纹理图' });
};

export const getCardHint = (card, cardKind) => {
    if (card?.description) return card.description;
    if (cardKind === 'break') return '拖到玩家头像上，破坏对方工具';
    if (cardKind === 'repair') return '拖到玩家头像上，修复目标工具';
    if (cardKind === 'map') return '拖到终点牌上查看藏宝位置';
    if (cardKind === 'rockfall') return '拖到棋盘上的道路牌上移除它';
    if (cardKind === 'dead-end') return '可铺到棋盘上，但会制造受限道路';
    return `放置 ${card.name}`;
};

