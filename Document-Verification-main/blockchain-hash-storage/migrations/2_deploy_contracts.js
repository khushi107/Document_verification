const HashStorage = artifacts.require("HashStorage");

module.exports = function (deployer) {
  deployer.deploy(HashStorage, { gas: 6721975 });
};
