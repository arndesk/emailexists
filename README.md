<br />

<h1 align="center">@arndesk/emailexists</h1>
<h4 align="center">A NodeJS library for checking if an email address exists without sending any email.</h4>

<p align="center">
  <a href="#get-started">Get Started</a> &bull;
  <a href="#installation">Installation</a> &bull;
  <a href="#usage">Usage</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#contributing">Contributing</a> &bull;
  <a href="#license">License</a>
</p>

<h2 id="get-started">Get Started</h2>

<h3 id="installation">Installation</h3>

<p>Use <code>npm</code> to install this package:</p>

<pre>
<code>npm install @arndesk/emailexists</code>
</pre>

<h3 id="usage">Usage</h3>

<p>Here's a basic example of how to use qed-mail in your code:</p>

<pre>
<code>
const { validateEmail } = require('@arndesk/emailexists');

// Async function to use the validateEmail function
async function main() {
  const sender = null; //Not Important to set anything
  const recipient = 'recipient@example.com';
  const checkValid = true; // If false, then only check Format and MX Records

  try {
    const result = await validateEmail(sender, recipient, checkValid);
    console.log(result);
  } catch (error) {
    console.error(error);
  }
}

main();

</code>
</pre>

<h2 id="features">Features</h2>

<ul>
  <li>Validates the format of an email address</li>
  <li>Checks the MX records of the email domain</li>
  <li>Performs further validity checks depending on the user's requirements</li>
  <li>Can be used both as a standalone library or as a part of a larger project</li>
</ul>
