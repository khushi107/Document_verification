// SPDX-License-Identifier: MIT
pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;
contract HashStorage {
    // Mapping to store hashes and CIDs against unique IDs
    mapping(string => bytes32[]) private hashStorage;
    mapping(string => string[]) private cidStorage;

    // Event to log the hash and CID being stored
    event HashStored(string indexed id, bytes32 hash, string cid);

    // Function to store a new hash and CID against a unique ID
    function storeHash(string memory id, string memory _hash, string memory _cid) public {
        require(bytes(id).length > 0, "ID cannot be empty");
        require(bytes(_hash).length > 0, "Hash cannot be empty");
        require(bytes(_cid).length > 0, "CID cannot be empty");

        // Convert the hash to bytes32 and store it
        bytes32 hashBytes = sha256(abi.encodePacked(_hash));
        hashStorage[id].push(hashBytes);
        cidStorage[id].push(_cid);

        // Emit an event with the ID, stored hash, and CID
        emit HashStored(id, hashBytes, _cid);
    }

    // Function to retrieve only CIDs for a given ID
    function getCids(string memory id) public view returns (string[] memory) {
        require(bytes(id).length > 0, "ID cannot be empty");
        require(cidStorage[id].length > 0, "No CIDs found for the given ID");

        return cidStorage[id];
    }

    // Function to verify if a given hash matches the stored hash for a given ID
    function verifyHash(string memory id, string memory _hash) public view returns (bool) {
        require(bytes(id).length > 0, "ID cannot be empty");
        require(bytes(_hash).length > 0, "Hash cannot be empty");
        require(hashStorage[id].length > 0, "No hashes found for the given ID");

        bytes32 hashBytes = sha256(abi.encodePacked(_hash));
        for (uint256 i = 0; i < hashStorage[id].length; i++) {
            if (hashStorage[id][i] == hashBytes) {
                return true; // Hash matches
            }
        }

        return false; // No match found
    }
}
