/* global Strava sauce */

sauce.ns('dashboard', function(ns) {

    function feedEvent(action, category, count) {
        if (!count) {
            return;
        }
        sauce.rpc.reportEvent('ActivityFeed', action, category, {
            nonInteraction: true,
            eventValue: count
        });
    }


    let scheduledAthleteDefined;
    function hideVirtual(feedEl) {
        if (!self.currentAthlete) {
            // Too early in page load to filter out virtual activities.
            if (!scheduledAthleteDefined) {
                console.info("Defering hide of virtual activities until currentAthlete info available.");
                sauce.propDefined('currentAthlete').then(() => filterFeed(feedEl));
                scheduledAthleteDefined = true;
            }
            return false;
        }
        let count = 0;
        for (const card of feedEl.querySelectorAll('.card:not(.hidden-by-sauce)')) {
            const ourId = self.currentAthlete.id;
            if (!ourId) throw new Error("foo");
            if (card.querySelector(`[class^="icon-virtual"], [class*=" icon-virtual"]`) &&
                !card.querySelector(`.entry-owner[href="/athletes/${ourId}"]`)) {
                console.info("Hiding Virtual Activity:", card.id || 'group activity');
                card.classList.add('hidden-by-sauce');
                count++;
            }
        }
        feedEvent('hide', 'virtual-activity', count);
        return !!count;
    }


    function hideChallenges(feedEl) {
        let count = 0;
        for (const card of feedEl.querySelectorAll('.card.challenge:not(.hidden-by-sauce)')) {
            console.info("Hiding challenge card:", card.id);
            card.classList.add('hidden-by-sauce');
            count++;
        }
        feedEvent('hide', 'challenge-card', count);
        return !!count;
    }


    function hidePromotions(feedEl) {
        let count = 0;
        for (const card of feedEl.querySelectorAll('.card.promo:not(.hidden-by-sauce)')) {
            console.info("Hiding promo card:", card.id);
            card.classList.add('hidden-by-sauce');
            count++;
        }
        feedEvent('hide', 'promo-card', count);
        return !!count;
    }


    let lastTimestamp;
    function orderChronological(feedEl) {
        let count = 0;
        for (const card of feedEl.querySelectorAll('.card:not(.ordered-by-sauce)')) {
            if (!card.dataset.updatedAt && lastTimestamp) {
                lastTimestamp += 1;
            } else {
                lastTimestamp = Number(card.dataset.updatedAt);
            }
            card.classList.add('ordered-by-sauce');
            card.style.order = `-${card.dataset.updatedAt}`;
            count++;
        }
        console.info(`Ordered ${count} cards chronologically`);
        feedEvent('sort-feed', 'chronologically');
        return !!count;
    }


    function filterFeed(feedEl) {
        let resetFeedLoader = false;
        if (sauce.options['activity-hide-promotions']) {
            resetFeedLoader |= hidePromotions(feedEl);
        }
        if (sauce.options['activity-hide-virtual']) {
            resetFeedLoader |= hideVirtual(feedEl);
        }
        if (sauce.options['activity-hide-challenges']) {
            resetFeedLoader |= hideChallenges(feedEl);
        }
        if (sauce.options['activity-chronological']) {
            resetFeedLoader |= orderChronological(feedEl);
        }
        if (resetFeedLoader) {
            // To prevent breaking infinite scroll we need to reset the feed loader state.
            // During first load pagination is not ready though, and will be run by the constructor.
            if (self.Strava && Strava.Dashboard && Strava.Dashboard.PaginationRouterFactory &&
                Strava.Dashboard.PaginationRouterFactory.view) {
                const view = Strava.Dashboard.PaginationRouterFactory.view;
                requestAnimationFrame(() => view.resetFeedLoader());
            }
        }
    }


    async function sendGAPageView(type) {
        await sauce.rpc.ga('set', 'page', `/site/dashboard`);
        await sauce.rpc.ga('set', 'title', 'Sauce Dashboard');
        await sauce.rpc.ga('send', 'pageview');
    }

    function monitorFeed(feedEl) {
        const mo = new MutationObserver(() => filterFeed(feedEl));
        mo.observe(feedEl, {childList: true});
        filterFeed(feedEl);
    }


    async function load() {
        sendGAPageView();  // bg okay
        const feedSelector = '.main .feed-container .feed';
        const feedEl = document.querySelector(feedSelector);
        if (!feedEl) {
            // We're early, monitor the DOM until it's here..
            const mo = new MutationObserver(() => {
                const feedEl = document.querySelector(feedSelector);
                if (feedEl) {
                    mo.disconnect();
                    monitorFeed(feedEl);
                }
            });
            mo.observe(document.documentElement, {childList: true, subtree: true});
        } else {
            monitorFeed(feedEl);
        }
        if (sauce.options['activity-hide-media']) {
            document.documentElement.classList.add('sauce-hide-dashboard-media');
        }
        if (sauce.options['activity-hide-images']) {
            document.documentElement.classList.add('sauce-hide-dashboard-images');
        }
        if (sauce.options['activity-hide-maps']) {
            document.documentElement.classList.add('sauce-hide-dashboard-images');
        }
    }


    return {
        load,
    };
}).then(async ns => {
    try {
        await ns.load();
    } catch(e) {
        await sauce.rpc.reportError(e);
        throw e;
    }
});
