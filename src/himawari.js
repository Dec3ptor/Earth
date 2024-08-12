import async from 'async';
import crypto from 'crypto-browserify';
import extend from 'deep-extend';
import axios from 'axios';
import moment from 'moment';
import tmp from 'tmp';

// The number of times a tile will attempted to be downloaded if the download fails
const retries = 5;

// Known hashes of images that contain "No Image" information
const emptyImages = {
  'b697574875d3b8eb5dd80e9b2bc9c749': 1
};

function downloadHimawari(userOptions) {
  return new Promise((resolve, reject) => {
    const options = extend({
      date: 'latest',
      debug: false,
      infrared: false,
      outfile: null,
      parallel: false,
      skipEmpty: true,
      timeout: 30000,
      urls: false,
      zoom: 1,
      success: () => {},
      error: () => {},
      chunk: () => {}
    }, userOptions);

    function log() {
      if (options.debug) {
        const args = Array.prototype.slice.call(arguments);
        args.unshift('[Himawari]');
        console.log.apply(console, args);
      }
    }

    const image_type = options.infrared ? 'INFRARED_FULL' : 'D531106';
    const base_url = 'http://himawari8.nict.go.jp/himawari8/img/' + image_type;

    log('Resolving date...');
    resolveDate(base_url, options.date, (err, now) => {
      if (err) {
        if (err.code === 'ETIMEDOUT') {
          return reject('Request to Himawari 8 server timed out. Please try again later.');
        } else {
          return reject(err);
        }
      }

      log('Date resolved', now.toString());

      now.setMinutes(now.getMinutes() - (now.getMinutes() % 10));
      now.setSeconds(0);

      const width = 550;
      const level = {
        INFRARED_FULL: { 1: "1d", 2: "4d", 3: "8d" },
        D531106: { 1: "1d", 2: "4d", 3: "8d", 4: "16d", 5: "20d" }
      }[image_type][options.zoom] || "1d";

      log('Zoom level set to ' + level);

      const blocks = parseInt(level.replace(/[a-zA-Z]/g, ''), 10);
      const time = moment(now).format('HHmmss');
      const year = moment(now).format('YYYY');
      const month = moment(now).format('MM');
      const day = moment(now).format('DD');

      const outfile = options.outfile || './' + [year, month, day, '_', time, '.jpg'].join('');
      const url_base = [base_url, level, width, year, month, day, time].join('/');

      const tiles = [];
      for (let x = 0; x < blocks; x++) {
        for (let y = 0; y < blocks; y++) {
          tiles.push({ name: x + '_' + y + '.png', x: x, y: y });
        }
      }

      const tmpDir = tmp.dirSync({ unsafeCleanup: true });

      let count = 1;
      let skipImage = false;
      const flow = options.parallel ? 'each' : 'eachSeries';
      async[flow](tiles, (tile, cb) => {
        if (skipImage) return cb();

        async.retry({ times: retries, interval: 500 }, (inner_cb) => {
          const uri = url_base + '_' + tile.name;
          const dest = tmpDir.name + '/' + tile.name;

          axios.get(uri, { responseType: 'arraybuffer', timeout: options.timeout })
            .then(response => {
              if (options.skipEmpty) {
                const hash = crypto.createHash('md5').update(response.data).digest('hex');
                if (emptyImages[hash]) {
                  log('Skipping empty tile...');
                  skipImage = true;
                  return inner_cb();
                }
              }

              log('Tile saved', dest);
              options.chunk({ chunk: dest, part: count, total: tiles.length });
              count++;
              return inner_cb();
            })
            .catch(err => {
              log('Failed to request file');
              return inner_cb('Failed to request file', err);
            });
        }, cb);
      }, (err) => {
        if (err) {
          log('Error occurred...', err);
          return reject(err);
        }

        if (options.urls) {
          return resolve();
        }

        if (skipImage) {
          log('No image data, skipping...');
          log('Cleaning temp files...');
          tmpDir.removeCallback();
          return resolve('No image available');
        }

        const magick = gm();
        for (let i = 0; i < tiles.length; i++) {
          const page = tiles[i];
          const coords = '+' + (page.x * width) + '+' + (page.y * width);
          magick.in('-page', coords).in(tmpDir.name + '/' + page.name);
        }

        log('Stitching images together...');
        magick.mosaic().write(outfile, (err) => {
          if (err) return reject(err);
          log('Cleaning temp files...');
          tmpDir.removeCallback();
          return resolve('File saved to ' + outfile);
        });
      });
    });
  });
}

function resolveDate(base_url, input, callback) {
  let date = input;

  if ((typeof input == "string" || typeof input == "number") && input !== "latest") {
    date = new Date(input);
  }

  if (moment.isDate(date)) {
    return callback(null, date);
  } else if (input === "latest") {
    const latest = base_url + '/latest.json';
    axios.get(latest, { timeout: 30000 })
      .then(response => {
        try {
          date = new Date(response.data.date);
        } catch (e) {
          date = new Date();
        }
        callback(null, date);
      })
      .catch(err => callback(err));
  } else {
    callback(null, new Date());
  }
}

export default downloadHimawari;
