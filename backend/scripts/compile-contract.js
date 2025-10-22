const fs = require('fs');
const path = require('path');
const solc = require('solc');

function compileContract() {
  try {
    const contractPath = path.join(__dirname, '../contracts/AddressManager.sol');
    const source = fs.readFileSync(contractPath, 'utf8');

    const input = {
      language: 'Solidity',
      sources: {
        'AddressManager.sol': {
          content: source,
        },
      },
      settings: {
        outputSelection: {
          '*': {
            '*': ['*'],
          },
        },
      },
    };

    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    if (output.errors) {
      console.log('Compilation errors:');
      output.errors.forEach(error => {
        console.log(error.formattedMessage);
      });
    }

    const contract = output.contracts['AddressManager.sol']['AddressManager'];

    const compiledContract = {
      abi: contract.abi,
      bytecode: contract.evm.bytecode.object,
      metadata: contract.metadata
    };

    // Save compiled contract
    const outputPath = path.join(__dirname, '../contracts/compiled/AddressManager.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(compiledContract, null, 2));

    console.log('Contract compiled successfully!');
    console.log('ABI and bytecode saved to:', outputPath);

    return compiledContract;
  } catch (error) {
    console.error('Error compiling contract:', error);
    throw error;
  }
}

if (require.main === module) {
  compileContract();
}

module.exports = compileContract;