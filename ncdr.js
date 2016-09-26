const Hyperfeed = require('.')
const request = require('request')

var feed = new Hyperfeed('0e7b4ce047f4cf6b23214cb054f155390fbcd4c5e3daf8ae1269cd9fc57f4dee')
feed.swarm()
feed.list().then(entries => {
  console.log(entries.map(x => x.author))
})
