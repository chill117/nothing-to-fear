# Nothing to Fear

Nothing to hide, nothing to fear. Pay a price for your privacy or lack thereof.

* [Live Demo](https://nothing-to-fear.degreesofzero.com/)
* [Running Your Own Instance](#running-your-own-instance)
* [Credits](#credits)
* [License](#license)


## Running Your Own Instance


### Requirements

* [nodejs](https://nodejs.org/) - For Linux and Mac install node via [nvm](https://github.com/creationix/nvm).
* [make](https://www.gnu.org/software/make/)


### Setup

Clone this repository:
```bash
git clone git@github.com:chill117/nothing-to-fear.git \
	&& cd nothing-to-fear
```

Install dependencies:
```bash
npm install
```

Run the toolbox services:
```bash
npm start
```
Do you see something like the following in your terminal?
```
Web server listening at http://localhost:8080
Lnurl server listening at http://localhost:3000
```
Great! Now open a browser to [localhost:8080](http://localhost:8080/) to view the web interface.

Note that this setup is only accessible on your local machine. If you want to be able to do some manual testing from a separate device like a phone, then you will need to expose the services to the internet.


## Credits

Inspired by [Nothing to Hide](https://nothing-to-hide-demo.s3.amazonaws.com/index.html) browser-based privacy game created by Nicky Case. Source code for the game can be found [here](https://github.com/ncase/nothing-to-hide).


## License

This software is [MIT licensed](https://tldrlegal.com/license/mit-license):
> A short, permissive software license. Basically, you can do whatever you want as long as you include the original copyright and license notice in any copy of the software/source.  There are many variations of this license in use.
