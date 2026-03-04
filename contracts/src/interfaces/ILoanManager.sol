// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILoanManager {
    function onAuctionSettled(uint256 tokenId, uint256 proceeds) external;
}
