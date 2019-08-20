const cache = new Map();
const lastUsedCache = new Map();

const MAX_AGE = 1000 * 60;
let isCollectingGarbage = false;
let gcTimeout = null;

const collectGarbage = () => {
    if (isCollectingGarbage) {
        const now = Date.now();
        for (const [id, lastUsed] of lastUsedCache) {
            if (now - lastUsed > MAX_AGE) {
                lastUsedCache.delete(id);
                cache.delete(id);
            }
        }
    }

    // If just kicking off GC or cache is not empty, schedule next GC
    if (!isCollectingGarbage || cache.size) {
        gcTimeout = setTimeout(() => {
            requestIdleCallback(collectGarbage);
        }, MAX_AGE + 100);
        isCollectingGarbage = true;
    } else {
        isCollectingGarbage = false;
    }
};

const resetGarbageCollection = () => {
    isCollectingGarbage = false;
    if (gcTimeout) clearTimeout(gcTimeout);
};

const makeSelectorForId = ({ selectorFactory, id }) => {
    // Kick off garbage collection if it isn’t yet running
    if (!isCollectingGarbage) collectGarbage();

    const selectorsForId = cache.get(id);
    const existing = selectorsForId && selectorsForId.get(selectorFactory);
    if (existing) return existing;

    const selectorInstance = selectorFactory(id);
    const selector = (...args) => {
        lastUsedCache.set(id, Date.now());
        return selectorInstance(...args);
    };

    cache.set(
        id,
        selectorsForId
            ? selectorsForId.set(selectorFactory, selector)
            : new Map([[selectorFactory, selector]]),
    );

    return selector;
};

const invokeSelectorForId = (state, payload) =>
    makeSelectorForId(payload)(state);

/*
 * The first returned function should be named e.g. makeGetFooForBar, and should be used to make input selectors
 * for use in composed selectors. The second returned function should be named e.g. getFooFromBar and should be used in
 * the mapStateToProps function of containers.
 */
const makeSelectorsForIdFromSelectorFactory = (selectorFactory) => [
    (id) => makeSelectorForId({ id, selectorFactory }),
    (state, id) => invokeSelectorForId(state, { id, selectorFactory }),
];

module.exports = makeSelectorsForIdFromSelectorFactory;
