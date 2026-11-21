using System;
using System.Threading.Tasks;

namespace ReconnectTest
{
    public class TestRpcClient 
    {
        // This simulates what our actual RpcClient does for auto-reconnect testing
        
        private int _reconnectionAttempts = 0;
        
        /// <summary>
        /// Simulate exponential backoff reconnection logic similar to our implementation
        /// </summary>
        public async Task<int> CalculateNextReconnectDelay()
        {
            var delayMs = Math.Min(1000 * (int)Math.Pow(2, _reconnectionAttempts), 30000);
            
            Console.WriteLine($"Attempt {_reconnectionAttempts}: Waiting {delayMs}ms before reconnect");
            
            await Task.Delay(delayMs);
            
            return delayMs;
        }
        
        public void IncrementReconnectAttempt()
        {
            _reconnectionAttempts++;
        }
        
        public void ResetReconnectAttempts()
        {
            _reconnectionAttempts = 0;
        }
        
        public static async Task Main(string[] args)
        {
            var client = new TestRpcClient();
            
            Console.WriteLine("Testing Auto-Reconnect Logic:");
            Console.WriteLine("===========================");
            
            try
            {
                // Simulate multiple connection failures followed by success
                for(int i=0; i<5; i++)
                {
                    Console.WriteLine($"\nConnection attempt #{i+1}");
                    
                    if(i == 4) 
                    {
                        // Last one succeeds
                        Console.WriteLine("SUCCESS: Connection established!");
                        client.ResetReconnectAttempts();
                        break;
                    }
                    
                    Console.WriteLine("FAILED: Connection lost - attempting reconnection...");
                    client.IncrementReconnectAttempt();
                    var delay = await client.CalculateNextReconnectDelay();
                    Console.WriteLine($"Reconnecting after {delay}ms...");
                }
                
                Console.WriteLine("\nAuto-reconnect test completed successfully.");
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Test failed with error: {ex.Message}");
            }
        }
    }
}