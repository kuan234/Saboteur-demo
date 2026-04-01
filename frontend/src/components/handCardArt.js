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
        assetName: '\u5341\u5b57\u8def\u53e3.png',
    },
    tee: {
        src: '/assets/%E4%B8%89%E5%8F%89%E8%B7%AF-%E5%8C%97%E4%B8%9C%E8%A5%BF.png',
        assetName: '\u4e09\u53c9\u8def-\u5317\u4e1c\u897f.png',
    },
    teeDeadEnd: {
        src: '/assets/%E4%B8%89%E5%8F%89%E8%B7%AF-%E5%A0%B5%E8%B7%AF-%E5%8C%97%E4%B8%9C%E8%A5%BF%E6%96%B9.png',
        assetName: '\u4e09\u53c9\u8def-\u5835\u8def-\u5317\u4e1c\u897f\u65b9.png',
    },
    straight: {
        src: '/assets/%E7%9B%B4%E8%B7%AF-%E5%8C%97%E6%96%B9.png',
        assetName: '\u76f4\u8def-\u5317\u65b9.png',
    },
    straightDeadEnd: {
        src: '/assets/%E7%9B%B4%E8%B7%AF-%E5%A0%B5%E8%B7%AF-%E5%8C%97%E6%96%B9.png',
        assetName: '\u76f4\u8def-\u5835\u8def-\u5317\u65b9.png',
    },
    doubleDeadEnd: {
        src: '/assets/%E5%8F%8C%E9%80%9A%E5%A0%B5%E8%B7%AF.png',
        assetName: '\u53cc\u901a\u5835\u8def.png',
    },
    crossDeadEnd: {
        src: '/assets/%E5%8D%81%E5%AD%97-%E5%A0%B5%E8%B7%AF.png',
        assetName: '\u5341\u5b57-\u5835\u8def.png',
    },
};

export const PATH_THEME = {
    border: 'border-green-700',
    label: '\u8def\u5f84\u724c',
    labelBg: 'bg-green-800/80',
};

export const DEAD_END_THEME = {
    border: 'border-rose-700',
    label: '\u5835\u8def\u724c',
    labelBg: 'bg-rose-800/80',
};

export const ACTION_THEMES = {
    break: {
        border: 'border-red-600',
        label: '\u7834\u574f\u724c',
        labelBg: 'bg-red-700/85',
    },
    repair: {
        border: 'border-cyan-500',
        label: '\u4fee\u7406\u724c',
        labelBg: 'bg-cyan-700/85',
    },
    map: {
        border: 'border-purple-700',
        label: '\u5730\u56fe\u724c',
        labelBg: 'bg-purple-800/80',
    },
    rockfall: {
        border: 'border-orange-700',
        label: '\u843d\u77f3\u724c',
        labelBg: 'bg-orange-800/80',
    },
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

export const rotateDirs180 = (dirs = []) => (
    Array.isArray(dirs) && dirs.length === 4 ? [dirs[2], dirs[3], dirs[0], dirs[1]] : dirs
);

export const getDisplayedDirs = (card, isRotated = false) => {
    const dirs = Array.isArray(card?.dirs) && card.dirs.length === 4 ? card.dirs : [];
    return isRotated ? rotateDirs180(dirs) : dirs;
};

export const getDisplayedDirsKey = (card, isRotated = false) => {
    const dirs = getDisplayedDirs(card, isRotated);
    return Array.isArray(dirs) && dirs.length === 4 ? dirs.join('') : '';
};

export const inferCardKind = (card) => {
    const name = String(card?.name || '').toLowerCase();
    const desc = String(card?.description || '').toLowerCase();
    const subType = String(card?.subType || card?.actionType || '').toLowerCase();

    if (card?.type === 'path' && (card?.subType === 'dead-end' || name.includes('\u5835\u8def'))) return 'dead-end';
    if (card?.type === 'path') return 'path';
    if (subType.includes('sabotage') || subType.includes('break') || name.includes('\u7834\u574f')) return 'break';
    if (subType.includes('repair') || name.includes('\u4fee\u7406') || desc.includes('\u4fee\u7406')) return 'repair';
    if (subType.includes('map') || name.includes('\u5730\u56fe')) return 'map';
    if (subType.includes('rockfall') || name.includes('\u843d\u77f3')) return 'rockfall';
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
            return buildArt({
                asset: ASSETS.crossDeadEnd,
                note: '\u5168\u5835\u6b7b\u76f4\u63a5\u4f7f\u7528\u5341\u5b57\u5835\u8def\u56fe',
            });
        }
        if (dirsKey === '1010') {
            return buildArt({
                asset: ASSETS.doubleDeadEnd,
                note: '\u53cc\u901a\u5835\u8def\u724c\u76f4\u63a5\u4f7f\u7528\u4e13\u7528\u53cc\u901a\u5835\u8def\u56fe',
            });
        }
        if (dirsKey === '0101') {
            return buildArt({
                asset: ASSETS.doubleDeadEnd,
                rotation: 90,
                mappingMode: 'rotated',
                note: '\u6c34\u5e73\u53cc\u901a\u5835\u8def\u724c\u4f7f\u7528\u53cc\u901a\u5835\u8def\u56fe\u65cb\u8f6c 90 \u5ea6',
            });
        }
        if (openCount === 1) {
            return buildArt({
                asset: ASSETS.straightDeadEnd,
                rotation: SINGLE_PATH_ROTATIONS[dirsKey] ?? 0,
                mappingMode: (SINGLE_PATH_ROTATIONS[dirsKey] ?? 0) === 0 ? 'direct' : 'rotated',
                note: '\u5355\u51fa\u53e3\u5835\u8def\u724c\u4f7f\u7528\u76f4\u8def\u5835\u8def\u56fe\u5e76\u6309\u65b9\u5411\u65cb\u8f6c',
            });
        }

        return buildArt({
            asset: ASSETS.teeDeadEnd,
            showLargeGlyph: true,
            mappingMode: 'fallback',
            note: '\u5176\u4f59\u5835\u8def\u724c\u5148\u590d\u7528\u4e09\u53c9\u5835\u8def\u56fe\uff0c\u5e76\u53e0\u52a0\u5927\u7b26\u53f7\u8f85\u52a9\u8bc6\u522b',
        });
    }

    if (dirsKey === '1111') {
        return buildArt({
            asset: ASSETS.cross,
            note: '\u666e\u901a\u5341\u5b57\u8def\u76f4\u63a5\u4f7f\u7528\u5341\u5b57\u8def\u53e3\u56fe',
        });
    }
    if (dirsKey === '1010') {
        return buildArt({
            asset: ASSETS.straight,
            note: '\u7ad6\u76f4\u76f4\u8def\u76f4\u63a5\u4f7f\u7528\u76f4\u8def\u56fe',
        });
    }
    if (dirsKey === '0101') {
        return buildArt({
            asset: ASSETS.straight,
            rotation: 90,
            mappingMode: 'rotated',
            note: '\u6c34\u5e73\u76f4\u8def\u4f7f\u7528\u76f4\u8def\u56fe\u65cb\u8f6c 90 \u5ea6',
        });
    }
    if (Object.prototype.hasOwnProperty.call(TEE_ROTATIONS, dirsKey)) {
        return buildArt({
            asset: ASSETS.tee,
            rotation: TEE_ROTATIONS[dirsKey],
            mappingMode: TEE_ROTATIONS[dirsKey] === 0 ? 'direct' : 'rotated',
            note: '\u4e09\u53c9\u8def\u7edf\u4e00\u590d\u7528\u540c\u4e00\u5f20\u5e95\u56fe\uff0c\u5e76\u6309\u5f00\u53e3\u65b9\u5411\u65cb\u8f6c',
        });
    }

    return buildArt({
        asset: ASSETS.dirt,
        showLargeGlyph: true,
        mappingMode: 'fallback',
        note: '\u5f53\u524d\u6ca1\u6709\u7cbe\u786e\u4e13\u56fe\uff0c\u5148\u4f7f\u7528\u77ff\u6d1e\u7eb9\u7406\u56fe\u5e76\u53e0\u52a0\u5927\u7b26\u53f7',
    });
};

export const getCardArt = (card) => {
    const cardKind = inferCardKind(card);

    if (cardKind === 'dead-end' || cardKind === 'path') {
        return getPathArt(card, cardKind);
    }
    if (cardKind === 'break') {
        return buildArt({ asset: ASSETS.sabotage, note: '\u7834\u574f\u724c\u4f7f\u7528 sabotage \u56fe\u7247' });
    }
    if (cardKind === 'repair') {
        return buildArt({ asset: ASSETS.repair, note: '\u4fee\u7406\u724c\u4f7f\u7528 repair \u56fe\u7247' });
    }
    if (cardKind === 'map') {
        return buildArt({ asset: ASSETS.map, note: '\u5730\u56fe\u724c\u4f7f\u7528 map \u56fe\u7247' });
    }
    if (cardKind === 'rockfall') {
        return buildArt({ asset: ASSETS.rockfall, note: '\u843d\u77f3\u724c\u4f7f\u7528 rockfall \u56fe\u7247' });
    }

    return buildArt({
        asset: ASSETS.dirt,
        mappingMode: 'fallback',
        note: '\u672a\u77e5\u724c\u578b\u5148\u4f7f\u7528\u77ff\u6d1e\u7eb9\u7406\u56fe',
    });
};

export const getCardHint = (card, cardKind) => {
    if (card?.description) return card.description;
    if (cardKind === 'break') return '\u62d6\u5230\u73a9\u5bb6\u5934\u50cf\u4e0a\uff0c\u7834\u574f\u5bf9\u65b9\u5de5\u5177';
    if (cardKind === 'repair') return '\u62d6\u5230\u73a9\u5bb6\u5934\u50cf\u4e0a\uff0c\u4fee\u590d\u76ee\u6807\u5de5\u5177';
    if (cardKind === 'map') return '\u62d6\u5230\u7ec8\u70b9\u724c\u4e0a\u67e5\u770b\u85cf\u5b9d\u4f4d\u7f6e';
    if (cardKind === 'rockfall') return '\u62d6\u5230\u68cb\u76d8\u4e0a\u7684\u9053\u8def\u724c\u4e0a\u79fb\u9664\u5b83';
    if (cardKind === 'dead-end') return '\u53ef\u94fa\u5230\u68cb\u76d8\u4e0a\uff0c\u4f46\u4f1a\u5236\u9020\u53d7\u9650\u9053\u8def';
    return `\u653e\u7f6e ${card.name}`;
};

export const getCompactCardName = (card) => {
    const cardKind = inferCardKind(card);
    const dirsKey = getDirsKey(card);
    const openCount = countOpenDirs(dirsKey);

    if (cardKind === 'break') return '\u7834\u574f';
    if (cardKind === 'repair') return '\u4fee\u7406';
    if (cardKind === 'map') return '\u5730\u56fe';
    if (cardKind === 'rockfall') return '\u843d\u77f3';

    if (cardKind === 'dead-end') {
        if (dirsKey === '0000') return '\u5168\u5835';
        if (openCount === 1) return '\u5355\u53e3\u5835';
        if (dirsKey === '1010' || dirsKey === '0101') return '\u53cc\u901a\u5835';
        if (openCount === 3) return '\u4e09\u53c9\u5835';
        return '\u5835\u8def';
    }

    if (dirsKey === '1111') return '\u5341\u5b57';
    if (dirsKey === '1010' || dirsKey === '0101') return '\u76f4\u8def';
    if (openCount === 3) return '\u4e09\u53c9';
    if (openCount === 2) return '\u62d0\u89d2';
    if (openCount === 1) return '\u5355\u53e3';
    return card?.name || '\u9053\u8def';
};
