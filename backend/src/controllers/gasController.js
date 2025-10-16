const gaslessService = require('../services/gaslessService');

const gasController = {
  async getBackendWalletInfo(req, res) {
    try {
      const balance = await gaslessService.getBackendWalletBalance();

      if (!balance) {
        return res.status(503).json({
          success: false,
          message: 'Backend wallet not initialized'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          address: balance.address,
          balance: balance.balance,
          balanceWei: balance.balanceWei,
          status: gaslessService.isReady() ? 'ready' : 'not ready'
        }
      });
    } catch (error) {
      console.error('Get backend wallet info error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get backend wallet info',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async getGasEstimates(req, res) {
    try {
      const userCreationEstimate = await gaslessService.estimateGasForUserCreation();
      const groupCreationEstimate = await gaslessService.estimateGasForGroupCreation();

      res.status(200).json({
        success: true,
        data: {
          userCreation: userCreationEstimate,
          groupCreation: groupCreationEstimate,
          note: 'These are estimated costs. Actual costs may vary based on network conditions.'
        }
      });
    } catch (error) {
      console.error('Get gas estimates error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get gas estimates',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  },

  async getServiceStatus(req, res) {
    try {
      const isReady = gaslessService.isReady();
      const contractAddress = gaslessService.getContractAddress();
      const balance = await gaslessService.getBackendWalletBalance();

      res.status(200).json({
        success: true,
        data: {
          gaslessEnabled: isReady,
          contractAddress: contractAddress,
          backendWallet: balance ? {
            address: balance.address,
            balance: balance.balance
          } : null,
          features: {
            gaslessRegistration: isReady,
            gaslessGroupCreation: isReady,
            userPaysNothing: isReady
          }
        }
      });
    } catch (error) {
      console.error('Get service status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get service status',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
};

module.exports = gasController;