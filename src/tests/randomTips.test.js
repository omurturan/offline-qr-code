import "https://unpkg.com/mocha@5.2.0/mocha.js"; /* globals mocha */
import "https://unpkg.com/chai@4.1.2/chai.js"; /* globals chai */
import "https://unpkg.com/sinon@6.1.5/pkg/sinon.js"; /* globals sinon */

import * as RandomTips from "/common/modules/RandomTips.js";
import * as CustomMessages from "/common/modules/MessageHandler/CustomMessages.js";

import * as AddonSettingsStub from "./modules/AddonSettingsStub.js";
import * as HtmlMock from "./modules/HtmlMock.js";

const HTML_BASE_FILE = "./randomTips/baseCode.html";

describe("common module: RandomTips", function () {
    before(function () {
        AddonSettingsStub.before();
    });

    beforeEach(function() {
        AddonSettingsStub.stubAllStorageApis();
        return HtmlMock.setTestHtmlFile(HTML_BASE_FILE);
    });

    afterEach(function() {
        CustomMessages.reset();
        AddonSettingsStub.afterTest();
        HtmlMock.cleanup();
        sinon.restore();
    });

    let savedTipHtml = null;

    /**
     * Saves the current state (HTML code) of the currently shown tip.
     *
     * @function
     * @returns {Promise}
     */
    function saveHtmlTestCode() {
        const elTip = document.querySelector("#messageTips");
        savedTipHtml = elTip.innerHTML;
    }

    /**
     * Resets the HTML code to the saved version.
     *
     * @function
     * @returns {Promise}
     */
    function resetHtmlTestCode() {
        const elTip = document.querySelector("#messageTips");
        elTip.innerHTML = savedTipHtml;
    }

    /**
     * Stubs the random function, so it always passes.
     *
     * @function
     * @param {string} [callFunction] an intermediate limitation of sinon stubs
     * @returns {Object} sinon stub
     */
    function disableRandomness(callFunction) {
        // randomizePassed in RandomTips passes for low values
        let stub = sinon.stub(Math, "random");
        if (callFunction) {
            stub = stub[callFunction]();
        }

        return stub.returns(0);
    }

    /**
     * Stubs the random function, so it always fails.
     *
     * @function
     * @param {string} [callFunction] an intermediate limitation of sinon stubs
     * @returns {Object} sinon stub
     */
    function forceFailRandomness(callFunction) {
        // randomizePassed in RandomTips fails for high values
        let stub = sinon.stub(Math, "random");
        if (callFunction) {
            stub = stub[callFunction]();
        }

        return stub.returns(1);
    }

    /**
     * Stubs "empty" "randomTips" setting, i.e. a a setting that has no values
     * and does not interfere with the result.
     *
     * @function
     * @returns {Promise}
     */
    function stubEmptySettings() {
        return AddonSettingsStub.stubSettings({
            "randomTips": {
                tips: {},
            }
        });
    }

    /**
     * Freeze the tip, as it is done in real-world applications.
     *
     * The statically defined tips {@link alwaysShowsTip} and {@link neverShowsTip}
     * are already prepared like this.
     *
     * @function
     * @param {Object} tip
     * @returns {Promise}
     */
    function prepareTip(tip) {
        return Object.freeze(tip);
    }

    const alwaysShowsTip = Object.freeze({ // eslint-disable-line mocha/no-setup-in-describe
        id: "alwaysShowsTip",
        requiredShowCount: null,
        requiredTriggers: 0,
        requireDismiss: false,
        maximumDismiss: null,
        text: "A tip to always show."
    });
    const neverShowsTip = Object.freeze({ // eslint-disable-line mocha/no-setup-in-describe
        id: "neverShowsTip",
        requiredShowCount: 0,
        requiredTriggers: 0,
        text: "A tip that may not show."
    });

    /**
     * Asserts that no random tip has been shown.
     *
     * @function
     * @param {string} message optional failure message
     * @returns {void}
     */
    function assertNoRandomTipShown(message) {
        let failureMessage = "RandomTip was shown, although no RandomTip was expected";
        if (message) {
            failureMessage += `, ${message}`;
        }
        chai.assert.exists(document.getElementById("noMessageShown"), failureMessage);
    }

    /**
     * Asserts that a random tip has been shown.
     *
     * @function
     * @param {string} message optional failure message
     * @returns {void}
     */
    function assertRandomTipShown(message) {
        let failureMessage = "RandomTip was not shown, although RandomTip was expected";
        if (message) {
            failureMessage += `, ${message}`;
        }

        chai.assert.notExists(document.getElementById("noMessageShown"), failureMessage);
    }

    /**
     * Returns the text of the currently shown tip.
     *
     * @function
     * @returns {string}
     */
    function getTextOfTip() {
        const elText = document.querySelector("#messageTips .message-text");
        return elText.innerHTML;
    }

    /**
     * Asserts that a specific random tip has been shown.
     *
     * @function
     * @param {string} expectedTipText the tip text to expect
     * @returns {void}
     */
    function assertRandomTipWithTextShown(expectedTipText) {
        assertRandomTipShown();

        const text = getTextOfTip();
        chai.assert.strictEqual(text, expectedTipText, "Tip with different message text shown.");
    }

    /**
     * Asserts that a specific random tip of a list has been shown.
     *
     * In contrast to {@link assertRandomTipWithTextShown()} this allows an array
     * of multiple allowed texts.
     *
     * @function
     * @param {Array.<string>} expectedTipTexts the tip texts to expect
     * @returns {string} the actually shown text
     */
    function assertOneOfRandomTipsShown(expectedTipTexts) {
        assertRandomTipShown();

        const text = getTextOfTip();

        chai.assert.oneOf(text, expectedTipTexts, "Tip with different message text than the allowed expected ones shown.");
        return text;
    }

    describe("showRandomTipIfWanted()", function () {
        beforeEach(function () {
            stubEmptySettings(); // TODO: for some reason, does not prevent count below from going to large
        });

        it("does not show tip if randomize fails", async function () {
            forceFailRandomness();

            await RandomTips.init([alwaysShowsTip]);
            RandomTips.showRandomTipIfWanted();

            assertNoRandomTipShown();
        });

        it("does show tip if randomize works", async function () {
            disableRandomness();

            await RandomTips.init([alwaysShowsTip]);
            RandomTips.showRandomTipIfWanted();

            assertRandomTipShown();
        });
    });

    describe("config savings", function () {
        let clock;

        beforeEach(function () {
            clock = sinon.useFakeTimers();
        });

        afterEach(function () {
            clock.restore();
        });

        it("adds settings template for storing data", async function () {
            disableRandomness();

            await RandomTips.init([alwaysShowsTip]);

            // need to wait as saving is debounced
            RandomTips.showRandomTipIfWanted();
            clock.next();

            // verify the setting has been saved
            sinon.assert.callCount(AddonSettingsStub.stubs.sync.set, 1);

            // verify the saved settings are expected
            const data = AddonSettingsStub.syncStorage.internalStorage;

            // verify it saved some settings
            // (may contain more data)
            chai.assert.containsAllDeepKeys(
                data,
                {
                    "randomTips": {
                        tips: {},
                        "triggeredOpen": 1
                    }
                }
            );

            // verify it's trigger count is set to 1
            chai.assert.nestedPropertyVal(data, "randomTips.triggeredOpen", 1);
        });

        it("counts triggeredOpen setting up", async function () {
            await AddonSettingsStub.stubSettings({
                "randomTips": {
                    tips: {},
                    "triggeredOpen": 999
                }
            });

            forceFailRandomness();

            await RandomTips.init([alwaysShowsTip]);

            // need to wait as saving is debounced
            RandomTips.showRandomTipIfWanted();
            clock.next();

            // verify the setting has been saved
            sinon.assert.callCount(AddonSettingsStub.stubs.sync.set, 1);

            // verify the saved settings are expected
            const data = AddonSettingsStub.syncStorage.internalStorage;

            // stubEmptySettings sets it to 999, so should be 1000 now
            chai.assert.strictEqual(
                data.randomTips.triggeredOpen,
                1000
            );
        });

        it("adds some config values for selected tip", async function () {
            stubEmptySettings();
            disableRandomness();

            await RandomTips.init([alwaysShowsTip]);

            // need to wait as saving is debounced
            RandomTips.showRandomTipIfWanted();
            clock.next();

            // verify the setting has been saved
            sinon.assert.callCount(AddonSettingsStub.stubs.sync.set, 1);

            // verify the saved settings are expected
            const data = AddonSettingsStub.syncStorage.internalStorage;

            // verify it saved some settings
            chai.assert.isNotEmpty(data.randomTips.tips.alwaysShowsTip);
        });
    });

    describe("showRandomTip() – single tip tests", function () {
        it("does nothing, if no tips specified", async function () {
            stubEmptySettings();

            await RandomTips.init([]);
            RandomTips.showRandomTip();

            assertNoRandomTipShown();
        });

        it("does show tip if tip is specified", async function () {
            stubEmptySettings();

            await RandomTips.init([alwaysShowsTip]);
            RandomTips.showRandomTip();

            assertRandomTipShown();
        });

        it("does not show tip, if tip config does not expect it to be shown", async function () {
            stubEmptySettings();

            await RandomTips.init([neverShowsTip]);
            RandomTips.showRandomTip();

            assertNoRandomTipShown();
        });

        it("correctly sets (displayed) values of tip", async function () {
            stubEmptySettings();

            // get tip
            const tip = Object.assign({}, alwaysShowsTip);
            tip.id = "someRandomTipId";
            tip.text = "A very unique tip for you! Unit test your stuff!";

            await RandomTips.init([prepareTip(tip)]);
            RandomTips.showRandomTip();

            const elTip = document.querySelector("#messageTips");

            chai.assert.strictEqual(elTip.dataset.tipId, "someRandomTipId", "invalid tip ID");
            chai.assert.strictEqual(getTextOfTip(), "A very unique tip for you! Unit test your stuff!", "invalid tip text");

            // other stuff is done in MessageHandler, and tested there
        });

        describe("requiredShowCount", function () {
            it("does display for null = infinity", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 99999
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.requiredShowCount = null; // actually already default in current tests

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertRandomTipShown();
            });

            it("does display if it still needs to show", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 2
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.requiredShowCount = 3;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertRandomTipShown();
            });

            it("does not display if already shown enough times", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 3
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.requiredShowCount = 3;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });

            it("stops display at x (here: 3) times shown", async function () {
                stubEmptySettings();

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.requiredShowCount = 3;

                await RandomTips.init([prepareTip(tip)]);

                // save state to restore it later
                // This is needed as the HTML node, where RandtomTips inserts it's
                // messages is saved once.
                saveHtmlTestCode();

                // one
                RandomTips.showRandomTip();
                assertRandomTipShown("failed on first display");
                resetHtmlTestCode();

                // two
                RandomTips.showRandomTip();
                assertRandomTipShown("failed on second display");
                resetHtmlTestCode();

                // three
                RandomTips.showRandomTip();
                assertRandomTipShown("failed on third display");
                resetHtmlTestCode();

                // 4th should not show anymore
                RandomTips.showRandomTip();
                assertNoRandomTipShown("failed on fourth display");
            });
        });

        describe("allowDismiss", function () {
            it("shows dismiss button by default (default setting = true)", async function () {
                stubEmptySettings();

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);

                await RandomTips.init([prepareTip(tip)]);
                RandomTips.showRandomTip();

                // get dismiss button
                const dismissButton = document.querySelector("#messageTips .icon-dismiss");

                chai.assert.exists(dismissButton); // should be always true
                chai.assert.isFalse(
                    dismissButton.classList.contains("invisible"),
                    "dismiss button is not visible although it is expected to be visible"
                );
            });

            it("shows dismiss button when allowDismiss = true", async function () {
                stubEmptySettings();

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.allowDismiss = true;

                await RandomTips.init([prepareTip(tip)]);
                RandomTips.showRandomTip();

                // get dismiss button
                const dismissButton = document.querySelector("#messageTips .icon-dismiss");

                chai.assert.exists(dismissButton); // should be always true
                chai.assert.isFalse(
                    dismissButton.classList.contains("invisible"),
                    "dismiss button is not visible although it is expected to be visible"
                );
            });

            it("does not show dismiss button when allowDismiss = false", async function () {
                stubEmptySettings();

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.allowDismiss = false;

                await RandomTips.init([prepareTip(tip)]);
                RandomTips.showRandomTip();

                // get dismiss button
                const dismissButton = document.querySelector("#messageTips .icon-dismiss");

                chai.assert.exists(dismissButton); // should be always true
                chai.assert.isTrue(
                    dismissButton.classList.contains("invisible"),
                    "dismiss button is visible although it is expected to be invisible"
                );
            });
        });

        describe("requireDismiss", function () {
            it("default setting = false, hide anyway, even if dismissedCount < shownCount", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 3,
                                dismissedCount: 2
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.requiredShowCount = 3;
                delete tip.requireDismiss;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });

            it("= false, hide anyway, if dismissedCount < shownCount", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 3,
                                dismissedCount: 2
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.requiredShowCount = 3;
                tip.requireDismiss = false;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });

            it("= true, show if not dismissed enough times", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 3,
                                dismissedCount: 2
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.requiredShowCount = 3;
                tip.requireDismiss = true;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertRandomTipShown();
            });

            it("= true: hide if dismissed enough times", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 3,
                                dismissedCount: 3
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.requiredShowCount = 3;
                tip.requireDismiss = true;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });

            it("= 3, show if not dismissed enough times", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 100,
                                dismissedCount: 2
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.requiredShowCount = 3;
                tip.requireDismiss = true;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertRandomTipShown();
            });

            it("= 3: hide if dismissed enough times", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 0,
                                dismissedCount: 3
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.requiredShowCount = 0;
                tip.requireDismiss = 3;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });
        });

        describe("maximumDismiss", function () {
            it("default = null: show message, even though dismissed many times", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 0,
                                dismissedCount: 999
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                delete tip.maximumDismiss;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertRandomTipShown();
            });

            it("= null: show message, even though dismissed many times", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 0,
                                dismissedCount: 999
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.maximumDismiss = null;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertRandomTipShown();
            });

            it("= 3: show message, if dismissed fewer times", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 0,
                                dismissedCount: 2
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.maximumDismiss = 3;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertRandomTipShown();
            });

            it("= 3: hide message, if dismissed 3 times", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {},
                                shownCount: 0,
                                dismissedCount: 3
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.maximumDismiss = 3;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });
        });

        describe("requiredTriggers", function () {
            it("does not show tip, if triggered less than 10 times for default value", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {},
                        triggeredOpen: 9,
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                delete tip.requiredTriggers;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });

            it("does not show tip, if triggered less times", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {},
                        triggeredOpen: 2,
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.requiredTriggers = 3;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });

            it("shows tip, if triggered enough times", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {},
                        triggeredOpen: 3,
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.requiredTriggers = 3;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertRandomTipShown();
            });
        });

        describe("showInContext", function () {
            it("shows tip if not yet shown and saves contextual display", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {}, // no information saved for tip
                    }
                });

                // get tip
                const tip = Object.assign({}, neverShowsTip);
                tip.showInContext = {
                    "testContext1": 1
                };

                await RandomTips.init([prepareTip(tip)]);
                RandomTips.setContext("testContext1");

                RandomTips.showRandomTip();
                assertRandomTipShown();

                chai.assert.deepNestedInclude(
                    AddonSettingsStub.syncStorage.internalStorage,
                    {"randomTips.tips.neverShowsTip.shownContext": {testContext1: 1}},
                    "does not save context shown count"
                );
            });

            it("shows tip, if not yet shown enough times in context", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "neverShowsTip": {
                                shownContext: {
                                    "testContext1": 0
                                }
                            }
                        },
                        triggeredOpen: 3,
                    }
                });

                // get tip
                const tip = Object.assign({}, neverShowsTip);
                tip.showInContext = {
                    "testContext1": 1
                };

                await RandomTips.init([prepareTip(tip)]);
                RandomTips.setContext("testContext1");

                RandomTips.showRandomTip();
                assertRandomTipShown();
            });

            it("do not show tip, if already shown enough times in context", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "neverShowsTip": {
                                shownContext: {
                                    "testContext1": 1
                                }
                            }
                        },
                        triggeredOpen: 3,
                    }
                });

                // get tip
                const tip = Object.assign({}, neverShowsTip);
                tip.showInContext = {
                    "testContext1": 1
                };

                await RandomTips.init([prepareTip(tip)]);
                RandomTips.setContext("testContext1");

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });

            it("does not show tip, if context is different", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {},
                    }
                });

                // get tip
                const tip = Object.assign({}, neverShowsTip);
                tip.showInContext = {
                    "testContext1": 5
                };

                await RandomTips.init([prepareTip(tip)]);
                RandomTips.setContext("differentContext");

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });

            it("saves context data, even if tip is shown, because of other reasons", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {},
                    }
                });

                await RandomTips.init([alwaysShowsTip]);
                RandomTips.setContext("currentContext");

                RandomTips.showRandomTip();

                chai.assert.deepNestedInclude(
                    AddonSettingsStub.syncStorage.internalStorage,
                    {"randomTips.tips.alwaysShowsTip.shownContext": {currentContext: 1}},
                    "does not save context shown count"
                );
            });
        });

        describe("maximumInContest", function () {
            it("does not show tip, if count for context has already been reached", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {
                                    "testContext1": 5
                                }
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.maximumInContest = {
                    "testContext1": 5
                };

                await RandomTips.init([prepareTip(tip)]);
                RandomTips.setContext("testContext1");

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });

            it("shows tip, if count for context has not yet been reached", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "alwaysShowsTip": {
                                shownContext: {
                                    "testContext1": 4
                                }
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.maximumInContest = {
                    "testContext1": 5
                };

                await RandomTips.init([prepareTip(tip)]);
                RandomTips.setContext("testContext1");

                RandomTips.showRandomTip();
                assertRandomTipShown();
            });

            it("shows tip exactly x times (with showInContext)", async function () {
                await AddonSettingsStub.stubSettings({
                    "randomTips": {
                        tips: {
                            "neverShowsTip": {
                                shownContext: {
                                    "testContext1": 3
                                }
                            }
                        },
                    }
                });

                // get tip
                const tip = Object.assign({}, neverShowsTip);
                tip.showInContext = {
                    "testContext1": 4
                };
                tip.maximumInContest = {
                    "testContext1": 4
                };

                // save state to restore it later
                // This is needed as the HTML node, where RandtomTips inserts it's
                // messages is saved once.
                saveHtmlTestCode();

                await RandomTips.init([prepareTip(tip)]);
                RandomTips.setContext("testContext1");

                // show first time
                RandomTips.showRandomTip();
                assertRandomTipShown("does not care for showInContext");

                // shownContext+1=5
                resetHtmlTestCode();

                // shownContext
                RandomTips.showRandomTip();
                assertNoRandomTipShown("does not care for maximumInContest");
            });
        });

        describe("randomizeDisplay", function () {
            beforeEach(function () {
                stubEmptySettings();
            });

            it("does not show tip, if custom tip randomize (=true) fails", async function () {
                // need to skip first call, because that is the one selecting
                // the test to be done
                forceFailRandomness("onSecondCall").callThrough();

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.randomizeDisplay = true;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });

            it("shows tip, if custom tip randomize (=true) works", async function () {
                // need to skip first call, because that is the one selecting
                // the test to be done
                disableRandomness("onSecondCall").callThrough();

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.randomizeDisplay = true;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertRandomTipShown();
            });

            it("does not show tip, if custom tip randomize with number fails", async function () {
                // need to skip first call, because that is the one selecting
                // the test to be done
                forceFailRandomness("onSecondCall").callThrough();

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.randomizeDisplay = 0.2;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertNoRandomTipShown();
            });

            it("shows tip, if custom tip randomize with number works", async function () {
                // need to skip first call, because that is the one selecting
                // the test to be done
                disableRandomness("onSecondCall").callThrough();

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.randomizeDisplay = 0.2;

                await RandomTips.init([prepareTip(tip)]);

                RandomTips.showRandomTip();
                assertRandomTipShown();
            });
        });

        describe("actionButton", function () {
            it("displays no action button when not used", async function () {
                stubEmptySettings();

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);

                await RandomTips.init([prepareTip(tip)]);
                RandomTips.showRandomTip();

                // get action button
                const actionButton = document.querySelector("#messageTips button");

                chai.assert.exists(actionButton); // should be always true
                chai.assert.isTrue(
                    actionButton.classList.contains("invisible"),
                    "action button is visible although it is expected to be not visible"
                );
                chai.assert.notStrictEqual(
                    actionButton.innerHTML,
                    "thisIsAnActionButton",
                    "action button has wrong text"
                );
            });

            it("displays working action button when used", async function () {
                stubEmptySettings();

                // get tip
                const tip = Object.assign({}, alwaysShowsTip);
                tip.actionButton = {
                    text: "thisIsAnActionButton",
                    action: sinon.spy()
                };

                await RandomTips.init([prepareTip(tip)]);
                RandomTips.showRandomTip();

                // get action button
                const actionButton = document.querySelector("#messageTips button");

                chai.assert.exists(actionButton); // should be always true
                chai.assert.isFalse(
                    actionButton.classList.contains("invisible"),
                    "action button is not visible although it is expected to be visible"
                );
                chai.assert.strictEqual(
                    actionButton.innerHTML,
                    "thisIsAnActionButton",
                    "action button has wrong text"
                );

                // click button
                actionButton.click();

                // assert callback has been called
                sinon.assert.calledOnce(tip.actionButton.action);
            });
        });
    });

    describe("message interaction", function () {
        let clock;

        beforeEach(function () {
            clock = sinon.useFakeTimers();
        });

        afterEach(function () {
            clock.restore();
        });

        it("sets and removes tipId when tip is shown and hidden", async function () {
            stubEmptySettings();
            disableRandomness();

            await RandomTips.init([alwaysShowsTip]);

            // need to wait as saving is debounced
            RandomTips.showRandomTip();
            clock.next();

            // verify tip ID is there
            const message = document.querySelector("#messageTips");
            chai.assert.strictEqual(message.dataset.tipId, "alwaysShowsTip", "tip ID not set when tip is shown");

            // dismiss message
            const dismissButton = document.querySelector("#messageTips .icon-dismiss");
            dismissButton.click();

            // verify tip ID is reset/removed
            chai.assert.notProperty(message.dataset, "tipId", "tip ID not removed after tip has been hidden");
        });

        it("saves dismissedCount when dismissed", async function () {
            stubEmptySettings();
            disableRandomness();

            await RandomTips.init([alwaysShowsTip]);

            // need to wait as saving is debounced
            RandomTips.showRandomTip();
            clock.next();

            // dismiss message
            const dismissButton = document.querySelector("#messageTips .icon-dismiss");
            dismissButton.click();

            // need to wait as saving is debounced
            clock.next();

            // verify the saved settings are expected
            const data = AddonSettingsStub.syncStorage.internalStorage;

            // verify it saved the settings correctly
            chai.assert.nestedPropertyVal(
                data,
                "randomTips.tips.alwaysShowsTip.dismissedCount",
                1
            );
        });
    });

    describe("showRandomTip() – multiple tips", function () {
        it("does show multiple (2) tips", async function () {
            stubEmptySettings();

            const tip1 = Object.assign({}, alwaysShowsTip);
            tip1.text = "tip1Text";
            const tip2 = Object.assign({}, alwaysShowsTip);
            tip2.text = "tip2Text";

            let tip1InternalCount = 0;
            let tip2InternalCount = 0;

            await RandomTips.init([prepareTip(tip1), prepareTip(tip2)]);

            // show tips again and again until it finally has shown both tips at
            // least once
            do {
                RandomTips.showRandomTip();

                const shownTip = assertOneOfRandomTipsShown(["tip1Text", "tip2Text"]);

                switch (shownTip) {
                case "tip1Text":
                    tip1InternalCount++;
                    break;
                case "tip2Text":
                    tip2InternalCount++;
                    break;
                }
            } while (tip1InternalCount > 0 && tip2InternalCount > 0);
        });

        it("does only show valid tip", async function () {
            stubEmptySettings();

            const tip1 = Object.assign({}, alwaysShowsTip);
            tip1.text = "tip1Text";
            tip1.requiredShowCount = 0; // should never show
            const tip2 = Object.assign({}, alwaysShowsTip);
            tip2.text = "tip2Text";

            await RandomTips.init([prepareTip(tip1), prepareTip(tip2)]);

            // repeat 3 times, to be sure
            for (let i = 0; i < 3; i++) {
                RandomTips.showRandomTip();

                assertRandomTipWithTextShown("tip2Text");
            }
        });

        it("does only show tip, where settings allow it", async function () {
            AddonSettingsStub.stubSettings({
                "randomTips": {
                    tips: {
                        "alreadyShownTip1": {
                            shownCount: 1
                        }
                    },
                    "triggeredOpen": 999 // prevent fails due to low trigger count
                }
            });
            const tip1 = Object.assign({}, alwaysShowsTip);
            tip1.id = "alreadyShownTip1";
            tip1.requiredShowCount = 1; // already shown enough times
            tip1.text = "tip1Text";

            const tip2 = Object.assign({}, alwaysShowsTip);
            tip2.text = "tip2Text";

            await RandomTips.init([prepareTip(tip1), prepareTip(tip2)]);

            // repeat 3 times, to be sure
            for (let i = 0; i < 3; i++) {
                RandomTips.showRandomTip();

                assertRandomTipWithTextShown("tip2Text");
            }
        });

        it("does show tips relatively randomly", async function () {
            stubEmptySettings();

            const tipArray = [];
            // const tipArrayTexts = [];
            const tipCount = [];

            for (let i = 0; i < 10; i++) {
                const tip = Object.assign({}, alwaysShowsTip);
                tip.text = `tip${i}Text`;

                tipArray.push(prepareTip(tip));
                // tipArrayTexts.push(tip.text);
                tipCount[i] = 0;
            }

            await RandomTips.init(tipArray);

            // show tips again and again until it finally has shown both tips at
            // least once
            for (let i = 0; i < 1000; i++) {
                RandomTips.showRandomTip();

                // to speed up tests, we do not use assertOneOfRandomTipsShown()
                // here.
                // const shownTip = assertOneOfRandomTipsShown(tipArrayTexts);
                const shownTip = getTextOfTip();

                // We can assume it matches correctly, if not the test fails
                // with an exception.

                // https://regex101.com/r/3zhjAe/1
                const matches = /tip(\d*)Text/.exec(shownTip);
                const num = matches[1]; // first matched group

                // count up
                tipCount[num]++;
            }

            // assert that each message was not shown too few or too much times
            // expectation value: 100; we allow an absolute variance of 50
            for (let i = 0; i < 10; i++) {
                chai.assert.isAtLeast(tipCount[i], 50, `tip #${i} has been shown too few times`);
                chai.assert.isAtMost(tipCount[i], 150, `tip #${i} has been shown too much times`);
            }
        });
    });
});
