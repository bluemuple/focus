// =============================================================
//  WordCatch — asset manifest
//
//  Single source of truth for sprite paths + display names.
//  Generated to match the slug order produced by
//  scripts/crop-assets.py (weak → strong, row-major).
//
//  Exposes:
//    window.WCAssets.levels[level]      → { real, silhouette } image paths
//      level ∈ { -1, 1, 2, 3, 4, 5 }
//    window.WCAssets.sets[setName]      → array of 10
//      [{ index, slug, label, real, silhouette }, …]
//      setName ∈ 'animals' | 'nz-animals' | 'penguin'
//    window.WCAssets.allSetNames        → ['animals','nz-animals','penguin']
//
//  Index = position 0..9 in weak-to-strong order. The animal_index
//  column on wc_student_pets stores this exact value, so the manifest
//  can resolve any caught animal back to a sprite + label.
// =============================================================
(() => {
  const ROOT = './images';

  const levels = {};
  [-1, 1, 2, 3, 4, 5].forEach(lvl => {
    levels[lvl] = {
      real:       `${ROOT}/levels/level-${lvl}.png`,
      silhouette: `${ROOT}/levels/level-${lvl}-silhouette.png`,
    };
  });

  // Display labels match the labels rendered onto the source sheets.
  // The slug list mirrors crop-assets.py exactly — keep them in sync.
  const SETS_DATA = {
    'animals': [
      ['mouse',    'Mouse'   ],
      ['squirrel', 'Squirrel'],
      ['rabbit',   'Rabbit'  ],
      ['fox',      'Fox'     ],
      ['dog',      'Dog'     ],
      ['wolf',     'Wolf'    ],
      ['cheetah',  'Cheetah' ],
      ['bear',     'Bear'    ],
      ['tiger',    'Tiger'   ],
      ['lion',     'Lion'    ],
    ],
    'nz-animals': [
      ['sheep',      'Sheep'      ],
      ['piwakawaka', 'Pīwakawaka' ],
      ['tui',        'Tūī'        ],
      ['pukeko',     'Pūkeko'     ],
      ['kereru',     'Kererū'     ],
      ['weta',       'Wētā'       ],
      ['kea',        'Kea'        ],
      ['kiwi',       'Kiwi'       ],
      ['tuatara',    'Tuatara'    ],
      ['takahe',     'Takahē'     ],
    ],
    'penguin': [
      ['korora',        'Kororā'        ],
      ['tawaki',        'Tawaki'        ],
      ['adelie',        'Adélie'        ],
      ['hoiho',         'Hoiho'         ],
      ['gentoo',        'Gentoo'        ],
      ['king',          'King'          ],
      ['emperor',       'Emperor'       ],
      ['kekeno',        'Kekeno'        ],
      ['sea-lion',      'Sea Lion'      ],
      ['elephant-seal', 'Elephant Seal' ],
    ],
  };

  const sets = {};
  Object.keys(SETS_DATA).forEach(name => {
    sets[name] = SETS_DATA[name].map(([slug, label], i) => {
      const prefix = String(i + 1).padStart(2, '0');
      return {
        index: i,
        slug,
        label,
        real:       `${ROOT}/animals/${name}/${prefix}-${slug}.png`,
        silhouette: `${ROOT}/animals/${name}/${prefix}-${slug}-silhouette.png`,
      };
    });
  });

  window.WCAssets = {
    levels,
    sets,
    allSetNames: Object.keys(SETS_DATA),

    // Convenience lookups for the encounter system.
    spriteFor(setName, index, asSilhouette) {
      const s = sets[setName];
      if (!s || index < 0 || index >= s.length) return null;
      return asSilhouette ? s[index].silhouette : s[index].real;
    },
    labelFor(setName, index) {
      const s = sets[setName];
      return s && s[index] ? s[index].label : '';
    },
    // For 'mixed' lessons / random gifting: returns { setName, index } pairs.
    randomPick(rng) {
      const r = rng || Math.random;
      const setNames = Object.keys(SETS_DATA);
      const setName  = setNames[Math.floor(r() * setNames.length)];
      const index    = Math.floor(r() * sets[setName].length);
      return { setName, index };
    },
  };
})();
