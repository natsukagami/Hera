#include <iostream>
#include <vector>
using namespace std;

vector<int> V;

int main() {
	int a, b; 
	cin >> a >> b;
	cout << a + b << endl;
	while (a++) V.push_back(a); 
}
