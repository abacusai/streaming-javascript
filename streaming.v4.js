(function() {
    var METHOD_DATASET = {
        addUserItemInteraction: 'interaction',
        upsertItemAttributes: 'item',
        upsertUserAttributes: 'user'
    }
    var PREDICTION_METHOD_DATASET = {
        getRecommendations: 'recommendations',
        getRelatedItems: 'related',
        getRankedItems: 'ranked',
        getPersonalizedRanking: 'personalized'
    }
    var METHOD_ATTRIBUTES = {
        addUserItemInteraction: 'additionalAttributes',
        upsertItemAttributes: 'itemAttributes',
        upsertUserAttributes: 'userAttributes'
    }
    var USER_KEY = 'userId';
    var ITEM_KEY = 'itemId';
    var TIMESTAMP_KEY = 'timestamp';
    var DATA_KEY = 'data';
    var ENDPOINT;
    var AUTH_PARAM;
    var DATASETS;
    var userId;
    var DEPLOYMENT_ID;
    var DEPLOYMENT_PARAM;
    var PREDICTION_USER_KEY = 'userId';

    var timerReCall = null;
    var interactionBuffer = [];
    var currentTimestamp = -1;

    function initREaiCookieUser() {
        let userCookie = document.cookie.split(';').find(function(entry) {
            return entry.trim().startsWith('abacusAiUserId=');
        });
        if (userCookie) {
            userId = userCookie.split('=')[1].trim();
        } else {
            userId = 're/' + ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                let r = Math.random() * 16 | 0,
                    v = c == 'x' ? r : (r & 0x3 | 0x8);
                return v.toString(16);
            }))
            document.cookie = `abacusAiUserId=${userId}; path="/"; max-age=86400`
            if ('user' in DATASETS && DATASETS['user']) {
                interactionBuffer.push({
                    method: 'upsertUserAttributes',
                    datasetId: DATASETS.user,
                    data: {
                        [USER_KEY]: userId,
                        'userAttributes': {
                            '_timezone': (new Date()).getTimezoneOffset(),
                            '_referrer': document.referrer,
                            '_useragent': navigator.userAgent,
                            '_screendim': window.screen.width + "x" + window.screen.height
                        }

                    }
                });

                if (timerReCall == null) {
                    timerReCall = setTimeout(flushInteractions, 10);
                }
            }

        }
    }

    function methodUrl(method, datasetId) {
        return `${ENDPOINT}/${method}?${AUTH_PARAM}&datasetId=${datasetId}`;
    }

    function predictionUrl(method) {
        return `${ENDPOINT}/${method}?${DEPLOYMENT_PARAM}&deploymentId=${DEPLOYMENT_ID}`;
    }

    function reaitag(command, params, callback = () => {}) {
        if (command === 'init') {
            if (!params) {
                console.warn('Missing required init params.')
                return
            }
            let subdomain = (params.workspace || '').replace(/[^a-zA-Z0-9]/g, '') || 'www';
            ENDPOINT = `https://${subdomain}.abacus.ai/api`
            AUTH_PARAM = 'streamingToken=' + params.streamingToken;
            DATASETS = params.datasets || {}
            DEPLOYMENT_ID = params.deploymentId || null;
            DEPLOYMENT_PARAM = 'deploymentToken=' + params.deploymentToken;
            PREDICTION_USER_KEY = params.userKey;
            if (params.hasOwnProperty(USER_KEY) && params[USER_KEY]) {
                userId = params[USER_KEY];
            } else {
                if (params.hasOwnProperty(USER_KEY)) {
                    console.error('Invalid value for userId field, using cookie instead.')
                }
                initREaiCookieUser()
            }
            callback(userId);
            return userId;
        }

        if (command === 'setUser') {
            if (params) {
                userId = params
            }
            return;
        }

        if (command === 'getUser') {
            callback(userId);
            return userId;
        }

        if (command in METHOD_DATASET) {
            if (!params) {
                console.log('Missing update data');
                return;
            }

            let dataset_key = METHOD_DATASET[command];
            if (!DATASETS || !DATASETS.hasOwnProperty(dataset_key)) {
                console.warn('No dataset configured for ' + command);
                return;
            }

            let update = Object.assign({}, params);
            let attributes_key = METHOD_ATTRIBUTES[command];

            if (!params.hasOwnProperty(TIMESTAMP_KEY)) {
                currentTimestamp = Math.max(currentTimestamp + 1, Date.now())
                update[TIMESTAMP_KEY] = currentTimestamp;
            }

            if (['addUserItemInteraction', 'upsertUserAttributes'].indexOf(command) >= 0) {
                if (!params.hasOwnProperty(USER_KEY)) {
                    update[USER_KEY] = userId;
                }
            }

            if (!update.hasOwnProperty(attributes_key)) {
                update[attributes_key] = {};
            }
            let attributes = update[attributes_key];

            interactionBuffer.push({
                method: command,
                datasetId: DATASETS[dataset_key],
                data: update
            });

            if (timerReCall == null) {
                timerReCall = setTimeout(flushInteractions, 10);
            }

            return;
        }
        if (command in PREDICTION_METHOD_DATASET) {
            if (!params) {
                params = { data: {} };
            } else if (params.data == null) {
                params.data = {};
            }
            if (PREDICTION_USER_KEY && (!params.data || !params.data.hasOwnProperty(PREDICTION_USER_KEY))) {
                params.data[PREDICTION_USER_KEY] = userId;
            }
            flushInteractions();
            params.reaiRetryNum = 0;

            postPrediction(command, params, callback);
            return;
        }

        console.error('Unrecognized reaitag command ' + command)
    }

    function flushInteractions() {
        timerReCall = null;

        if (interactionBuffer.length === 0) {
            return;
        }

        let params = {
            event: interactionBuffer.shift(),
            reaiRetryNum: 0
        }
        postInteractions(params);

        if (interactionBuffer.length > 0) {
            timerReCall = setTimeout(flushInteractions, 200);
        }
    }

    function postInteractions(params) {
        var request = new XMLHttpRequest();
        request.open('POST', methodUrl(params.event.method, params.event.datasetId), true);
        request.onload = function() {
            if (request.status >= 500 && params.reaiRetryNum < 3) {
                console.warn('Error recording interactions: ' + request.status);
                params.reaiRetryNum += 1;
                setTimeout(function() { postInteractions(params) }, params.reaiRetryNum * 5 * 1000);
            }
        };

        request.setRequestHeader("Content-Type", "application/json");
        request.send(JSON.stringify(params.event.data));
    }

    function postPrediction(method, params, callback) {
        var request = new XMLHttpRequest();
        request.open('POST', predictionUrl(method), true);
        request.onload = function() {
            if (request.status == 200) {
                callback(JSON.parse(request.response).result, null);
            } else if (request.status >= 500 && params.reaiRetryNum < 3) {
                console.warn('Prediction recording interactions: ' + request.status);
                params.reaiRetryNum += 1;
                setTimeout(function() { postPrediction(params, callback) }, params.reaiRetryNum * 5 * 1000);
            } else if (request.status >= 400) {
                callback(null, JSON.parse(request.response).error);
            } else {
                callback(null, 'Error making prediction call: ' + request.status)
            }
        };

        request.setRequestHeader("Content-Type", "application/json");
        request.send(JSON.stringify({ "queryData": params.data, ...params.options }));
    }


    window.reaitag = reaitag;

    if (window.reDataList) {
        let list = window.reDataList.slice(0);
        window.reDataList = [];

        list.forEach(function(item) {
            reaitag.apply(this, item);
        });
    }
})();
