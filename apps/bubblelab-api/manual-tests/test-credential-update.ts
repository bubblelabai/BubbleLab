import { TestApp } from '../src/test/test-app.js';

async function testCredentialUpdate() {
  console.log('🧪 Testing credential update functionality...\n');

  try {
    // 1. Create a credential first
    console.log('1. Creating a test credential...');
    const createResponse = await TestApp.post('/credentials', {
      credentialType: 'OPENAI_CRED',
      value: 'sk-test-original-key',
      name: 'Test OpenAI Key',
    });

    if (createResponse.status !== 201) {
      throw new Error(`Failed to create credential: ${createResponse.status}`);
    }

    const createdCredential = await createResponse.json();
    console.log('✅ Credential created:', createdCredential);

    // 2. Update the credential
    console.log('\n2. Updating the credential...');
    const updateResponse = await TestApp.put(
      `/credentials/${createdCredential.id}`,
      {
        value: 'sk-test-updated-key',
        name: 'Updated Test OpenAI Key',
      }
    );

    if (updateResponse.status !== 200) {
      throw new Error(`Failed to update credential: ${updateResponse.status}`);
    }

    const updatedCredential = await updateResponse.json();
    console.log('✅ Credential updated:', updatedCredential);

    // 3. List credentials to verify the update
    console.log('\n3. Listing credentials to verify update...');
    const listResponse = await TestApp.get('/credentials');

    if (listResponse.status !== 200) {
      throw new Error(`Failed to list credentials: ${listResponse.status}`);
    }

    const credentials = await listResponse.json();
    const updatedCred = credentials.find(
      (c: any) => c.id === createdCredential.id
    );

    if (updatedCred) {
      console.log('✅ Found updated credential in list:', updatedCred);
      console.log(
        '   - Name updated:',
        updatedCred.name === 'Updated Test OpenAI Key'
      );
      console.log(
        '   - Value is encrypted (not visible):',
        updatedCred.value !== 'sk-test-updated-key'
      );
    } else {
      throw new Error('Updated credential not found in list');
    }

    // 4. Test updating with invalid ID
    console.log('\n4. Testing update with invalid ID...');
    const invalidUpdateResponse = await TestApp.put('/credentials/999999', {
      value: 'sk-test-invalid',
      name: 'Invalid Test',
    });

    if (invalidUpdateResponse.status !== 404) {
      throw new Error(
        `Expected 404 for invalid ID, got: ${invalidUpdateResponse.status}`
      );
    }
    console.log('✅ Invalid ID correctly returns 404');

    // 5. Clean up - delete the test credential
    console.log('\n5. Cleaning up - deleting test credential...');
    const deleteResponse = await TestApp.delete(
      `/credentials/${createdCredential.id}`
    );

    if (deleteResponse.status !== 200) {
      throw new Error(`Failed to delete credential: ${deleteResponse.status}`);
    }
    console.log('✅ Test credential deleted');

    console.log('\n🎉 All credential update tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Run the test
testCredentialUpdate().catch(console.error);
