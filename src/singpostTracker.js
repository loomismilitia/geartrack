'use strict';

const request = require('requestretry')
const parser = require('cheerio')
const utils = require('./utils')
const moment = require('moment-timezone')
const zone = "Asia/Singapore" // +8h

const URL = 'http://www.singpost.com/track-items'

const singpost = {}

/**
 * Get singpost info
 * Scraps the Singpost website
 * Async
 *
 * Design changes may break this code!!
 * @param id like RF23423423SG
 * @param callback(Error, SingpostInfo)
 */
singpost.getInfo = function (id, callback) {
    request.post({
        url: URL,
        form: {
            track_number: id,
            op: "Check item status",
            captoken: "",
        },
        timeout: 20000,
        maxAttempts: 2,
        retryDelay: 1000,
    }, function (error, response, body) {
        if (error || response.statusCode != 200) {
           return callback(utils.errorDown())
        }

        // Not found
        if (body.indexOf('Item status not found in the system.') != -1) {
            return callback(utils.errorNoData())
        }

        if(body.indexOf('This function is currently unavailable.') != -1) {
            return callback(utils.errorUnavailable())
        }

        let entity = null
        try {
            entity = createSingpostEntity(id, body)
            entity.retries = response.attempts
        } catch (error) {
            return callback(utils.errorParser(id, error.message))
        }

        callback(null, entity)

    })
}


/**
 * Create singpost entity from html
 * @param id
 * @param html
 */
function createSingpostEntity(id, html) {
    let $ = parser.load(html)

    let date = []
    $('span.tacking-date').each(function (i, elem) {
        date.push($(this).text().trim())
    })

    let status = []
    $('div.tacking-status').each(function (i, elem) {
        status.push($(this).text().trim())
    })

    let messages = []
    for(let i = 0; i < date.length; i++) {
        messages.push({
            date: moment.tz(date[i], "DD-MM-YYYY", zone).format(),
            state: status[i].replace(/ \(Country.+\)/ig, "").trim() // remove '(Country: PT)'
        })
    }

    return new SingpostInfo(id, messages)
}

/*
|--------------------------------------------------------------------------
| Entity
|--------------------------------------------------------------------------
*/
function SingpostInfo(id, messages) {
    this.id = id
    this.states = messages
    this.trackerWebsite = singpost.getLink(null)
}

singpost.getLink = function (id) {
    return URL
}

/*
|--------------------------------------------------------------------------
| Utils
|--------------------------------------------------------------------------
*/

module.exports = singpost