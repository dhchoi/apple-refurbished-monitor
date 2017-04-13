const debug = require("debug")("app:main");
const axios = require("axios");
const cheerio = require("cheerio");
const schedule = require("node-schedule");
const nodemailer = require("nodemailer");
const configs = require("./configs/configs.json");
const transporter = nodemailer.createTransport({
  service: "gmail", // allow less secure apps at https://myaccount.google.com/lesssecureapps
  auth: {
    user: configs.email,
    pass: configs.password
  }
});
const url = "https://www.apple.com/shop/browse/home/specialdeals/mac/macbook_pro/13";
const keywords = ["October", "2016", "16GB"];
let isMonitorEnabled = true;

const job = schedule.scheduleJob("0 */3 * * * *", () => { // every n minutes
  if (!isMonitorEnabled) {
    debug("Cancelling scheduled job...", new Date());
    return job.cancel();
  }
  debug("Performing scheduled job...", new Date());
  monitorWebpage();
});

function monitorWebpage() {
  axios.get(url).then(response => {
    const $ = cheerio.load(response.data);
    const products = [];

    $(".product").each((i, element) => {
      products.push({
        name: $(element).find("h3").text().trim(),
        specs: $(element).find(".specs").text().trim(),
        price: $(element).find(".price").find(".current_price").text().trim()
      });
    });
    debug("Found products:", products);
    
    return products;
  })
  .then(products => {
    const matches = products.filter(product => {
      return hasAllKeywordsInString(product.specs, keywords);
    });
    debug("Found matches:", matches);

    if (matches.length > 0) {
      sendEmail(
        `[Apple Refurbished Monitor] Found ${matches.length} Product Matches`,
        matches.map(product => {
          return `<p><b>${product.name}</b></p><p>${product.specs.replace(product.name, "").trim()}</p><p>${product.price}</p>`;
        }).join("<br>")
      );
    }
  })
  .catch(error => {
    const errMsg = error.response ? error.response.data : error.message;
    debug("Error occurred during webpage monitoring:", errMsg);
    sendEmail(
      "[Apple Refurbished Monitor] Monitoring Disabled",
      `<p>${errMsg}</p>`
    );
    isMonitorEnabled = false;
  });
}

function sendEmail(subject, body) {
  debug("Sending email with body:", body);
  transporter.sendMail({
    from: configs.email, // sender
    to: configs.email, // receivers
    subject: subject, // subject line
    html: body // html body
  }, (error, info) => {
    if (error) {
      return debug(error);
    }
    debug(`Message ${info.messageId} sent: ${info.response}`);
  });
}

function hasAllKeywordsInString(str, keywords) {
  const strToUpperCase = str.toUpperCase();
  for (let i = 0; i < keywords.length; i++) {
    if (!strToUpperCase.includes(keywords[i].toUpperCase())) {
      return false;
    }
  }

  return true;
}
