const Hyperfeed = require('.')
const request = require('request')

var feed = new Hyperfeed()
request('https://alerts.ncdr.nat.gov.tw/RssAtomFeed.ashx', (err, resp, body) => {
  feed.update(body).then(feed => {
    var sw = feed.swarm()
    sw.on('connection', () => { console.log('connected') })
    console.log(feed.key().toString('hex'))
  })
})
